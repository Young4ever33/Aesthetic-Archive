import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { validateAnalyzeImageRequest, ContractValidationError, assertRequestBodySize, MAX_JSON_BODY_BYTES } from '@/lib/validation';
import { callVisionProvider, gatewayError, getOwnedProvider, parseJsonObject, providerMeta, resolveModel } from '@/lib/ai-gateway';
import { logAiUsage } from '@/lib/ai-usage';

export const runtime = 'nodejs';

function id() { return `req_${crypto.randomUUID()}`; }
function failure(requestId: string, error: unknown) {
  const known = error as { code?: string; message?: string; retryable?: boolean; status?: number };
  const status = known.status || (error instanceof ContractValidationError ? 400 : 500);
  return NextResponse.json({ requestId, error: { code: known.code || (error instanceof ContractValidationError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR'), message: known.message || 'Unable to analyze image', retryable: known.retryable || false } }, { status });
}

const prompt = (body: ReturnType<typeof validateAnalyzeImageRequest>) => `Inspect only visible evidence in this image. Return one compact JSON object under 2500 characters with exactly: category, title, titleZh, summary, summaryZh, visibleFactsEn (max 5 short strings), visibleFactsZh (max 5 short strings), palette (max 6 hex colors), compositionEn, compositionZh, confidence. Category must be one of Architecture, Interior, Graphic Design, Brand Identity, Product Design, Fashion, Photography, Art Direction, Typography, Web / UI, Landscape, Furniture, Packaging, Other. Do not identify or invent people, brands, designers, architects, locations, dates, provenance, software, or hidden materials. No markdown and no commentary. Topic: ${body.topic || 'not provided'}.`;

function strings(value: unknown, limit: number): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()).slice(0, limit) : [];
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function assembleCard(raw: Record<string, unknown>) {
  const factsEn = strings(raw.visibleFactsEn, 5);
  const factsZh = strings(raw.visibleFactsZh, 5);
  const title = text(raw.title, 'Visual reference study');
  const titleZh = text(raw.titleZh, '视觉参考研究');
  const summary = text(raw.summary, factsEn.join(', ') || title);
  const summaryZh = text(raw.summaryZh, factsZh.join('，') || titleZh);
  const compositionEn = text(raw.compositionEn, 'balanced composition with a clear primary subject');
  const compositionZh = text(raw.compositionZh, '主体明确、层次清晰的平衡构图');
  const palette = strings(raw.palette, 6).filter((color) => /^#[0-9a-f]{6}$/i.test(color));
  const colorsEn = palette.length ? ` Color proportions are led by ${palette.join(', ')}.` : '';
  const colorsZh = palette.length ? ` 色彩以${palette.join('、')}为主，并保持参考图中的面积比例。` : '';
  return {
    category: text(raw.category, 'Other'), title, titleZh, summary,
    visibleFacts: factsEn,
    culturalContext: [],
    palette,
    composition: compositionEn,
    useCases: ['visual reference', 'moodboard', 'image generation'],
    promptZh: `${titleZh}。${summaryZh}。保持${factsZh.join('、') || '参考图中可见主体、空间关系与表面特征'}；采用${compositionZh}，锁定单一视角、前中后景关系、光线方向、材质表面与接缝。${colorsZh}保持真实尺度和结构边界，不添加品牌、人物身份、文字或标志。`,
    promptEn: `${title}. ${summary}. Preserve ${factsEn.join(', ') || 'the visible subject, spatial relationships, and surface characteristics'}; use ${compositionEn}, one fixed camera view, explicit foreground, middle ground and background, directional light, material surfaces and joints.${colorsEn} Preserve realistic scale and structural boundaries without adding brands, identities, text, or logos.`,
    negativePromptZh: '结构断裂，比例错误，透视畸变，材质漂移，过度装饰，虚构品牌，身份仿冒，乱码文字，标志，水印',
    negativePromptEn: 'broken structure, incorrect proportions, distorted perspective, material drift, excessive decoration, invented brands, identity imitation, garbled text, logos, watermarks',
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.7,
    reviewNotes: ['文化语境与来源需人工核验。'],
  };
}

export async function POST(request: Request) {
  const requestId = id();
  const startedAt = Date.now();
  let userId = '';
  let providerId: string | null = null;
  let model: string | null = null;
  try {
    assertRequestBodySize(request, MAX_JSON_BODY_BYTES);
    const { user, supabase } = await requireUser();
    userId = user.id;
    const body = validateAnalyzeImageRequest(await request.json());
    if (body.image.data.length > 14_000_000) throw gatewayError('INVALID_REQUEST', 'Image payload is too large', 413);
    const provider = await getOwnedProvider(body.providerId, user.id);
    providerId = provider.id;
    if (!provider.image_capable) throw gatewayError('FORBIDDEN', 'Provider does not support image analysis', 403);
    model = resolveModel(provider, body.model, 'image');
    const result = assembleCard(parseJsonObject(await callVisionProvider(provider, model, body.image, prompt(body))));
    await logAiUsage(supabase, { ownerId: userId, providerId, route: '/api/ai/analyze-image', model, status: 'success', requestId, durationMs: Date.now() - startedAt });
    return NextResponse.json({ requestId, data: result, meta: providerMeta(provider, model, body.templateId, body.templateVersion) });
  } catch (error) {
    if (userId) {
      const { supabase } = await requireUser().catch(() => ({ supabase: null as never }));
      if (supabase) await logAiUsage(supabase, { ownerId: userId, providerId, route: '/api/ai/analyze-image', model, status: 'error', requestId, error: error instanceof ContractValidationError ? 'INVALID_REQUEST' : (error instanceof Error ? error.message : 'unknown'), durationMs: Date.now() - startedAt });
    }
    return failure(requestId, error);
  }
}
