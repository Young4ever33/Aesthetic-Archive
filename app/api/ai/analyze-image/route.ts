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

const prompt = (body: ReturnType<typeof validateAnalyzeImageRequest>) => `Analyze the reference image for an aesthetic archive. Return ONLY valid JSON with these keys: category, title, titleZh, summary, visibleFacts (array), culturalContext (array; mark uncertainty), inferences (array), materials (array), lighting (array), geometry (array), typography (array), palette (array of hex strings), composition, useCases (array), promptZh, promptEn, negativePrompt, confidence (0 to 1), reviewNotes (array), source, rightsStatus. Distinguish visible facts from cultural interpretation. Never invent a designer, brand, location, date, provenance, software, or hidden material. promptZh and promptEn must each be a complete, directly runnable image-generation instruction for one concrete representative scene. Lock a specific subject, quantity and spatial relation, foreground/midground/background, camera position and lens character, light direction and color temperature, material surface and joints, dominant/support/accent color proportions, and output texture. Do not use placeholders, bracketed fill-in fields, variable lists, "user-provided subject", "replace with", use-case metadata, research notes, or model parameters inside either Prompt. Chinese output must not contain English template headings; English output must not contain Chinese. Keep negativePrompt separate and specific to failures that would break the reference style, composition, palette, or material logic. Topic: ${body.topic || 'not provided'}. Project context: ${body.projectContext || 'not provided'}.`;

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
    const result = parseJsonObject(await callVisionProvider(provider, model, body.image, prompt(body)));
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
