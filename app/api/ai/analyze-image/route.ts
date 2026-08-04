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

const prompt = (body: ReturnType<typeof validateAnalyzeImageRequest>) => `Analyze this reference image and return ONLY compact valid JSON with: category, title, titleZh, summary, visibleFacts (max 5), culturalContext (max 2; mark uncertainty), palette (max 6 hex colors), composition, useCases (max 4), promptZh, promptEn, negativePromptZh, negativePromptEn, confidence, reviewNotes (max 3). Do not invent identity, attribution, location, date, provenance, software, or hidden materials. Keep visible facts separate from interpretation. The Chinese and English Prompts must describe the same concrete scene and be directly runnable: specify subject quantity and relation, foreground/midground/background, one camera view, light direction, material surfaces, color proportions, and texture. No placeholders, parameters, slogans, unsupported attribution, text, logos, or watermarks. Chinese fields use Chinese only; English fields use English only. Keep every string concise and the complete JSON under 6000 characters. Topic: ${body.topic || 'not provided'}. Context: ${body.projectContext || 'not provided'}.`;

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
