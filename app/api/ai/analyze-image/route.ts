import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { validateAnalyzeImageRequest, ContractValidationError, assertRequestBodySize } from '@/lib/validation';
import { callVisionProvider, gatewayError, getOwnedProvider, parseJsonObject, providerMeta, resolveModel } from '@/lib/ai-gateway';
import { logAiUsage } from '@/lib/ai-usage';

export const runtime = 'nodejs';

function id() { return `req_${crypto.randomUUID()}`; }
function failure(requestId: string, error: unknown) {
  const known = error as { code?: string; message?: string; retryable?: boolean; status?: number };
  const status = known.status || (error instanceof ContractValidationError ? 400 : 500);
  return NextResponse.json({ requestId, error: { code: known.code || (error instanceof ContractValidationError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR'), message: known.message || 'Unable to analyze image', retryable: known.retryable || false } }, { status });
}

const prompt = (body: ReturnType<typeof validateAnalyzeImageRequest>) => `You are analyzing ${body.images.length} reference image(s) for one aesthetic card. Inspect every image separately before synthesizing the card. Identify the shared visual system across the set and important differences. Never describe an object, material, color, or composition from one image as if it appears in another. The title, summary, and generation prompts must represent the whole set; if the images do not form one coherent set, state that in reviewNotes instead of inventing a theme.

Return ONLY compact valid JSON using exactly these fields: category, customCategory, title, titleZh, summary, culturalContext, designElements, palette, tags, composition, useCases, promptZh, promptEn, negativePromptZh, negativePromptEn, confidence, reviewNotes.

Field responsibilities must not overlap:
- title/titleZh: use a restrained descriptive aesthetic name grounded in the shared visible subject, form, material, and visual language. Do not claim a named culture, movement, artist, designer, region, or historical style unless the supplied context contains a verifiable source clue. Do not use the file name, a generic style label, or an invented poetic name.
- summary: one sentence explaining the common aesthetic system.
- culturalContext: explain the aesthetic system and cultural context in at most 2 concise statements. If no verifiable source clue is supplied, explicitly say the cultural origin requires verification and limit the rest to cautious visual interpretation. Do not repeat visible design details.
- designElements: 3-6 unique visible production attributes such as form, material, lighting, geometry, typography, or image treatment; do not repeat composition, use cases, palette hex values, or prompt prose.
- palette: 4-6 unique hex colors representative of the whole image set.
- tags: 5-8 unique short English searchable nouns or noun phrases.
- composition: one concise description only of framing, hierarchy, spatial arrangement, viewpoint, and depth; do not list materials or use cases.
- useCases: 3-5 concrete design applications, not descriptions of the source images.
- promptZh/promptEn: directly runnable bilingual versions of the SAME representative scene. They must match the title and the full reference set, specifying subject quantity and relation, foreground/midground/background, one camera view, materials, color proportions, lighting, and finish. Do not copy one source image verbatim when the set contains multiple different subjects.
- negativePromptZh/negativePromptEn: specific drift prevention for that same scene.
- reviewNotes: at most 3 unresolved conflicts or uncertainties.

Do not invent identity, attribution, location, date, provenance, software, hidden materials, brands, public figures, text, logos, or watermarks. No placeholders, model parameters, quality slogans, or repeated phrases across fields. Chinese fields use Chinese only; English fields use English only. Keep the complete JSON under 7000 characters. Topic: ${body.topic || 'not provided'}. Context: ${body.projectContext || 'not provided'}.`;

export async function POST(request: Request) {
  const requestId = id();
  const startedAt = Date.now();
  let userId = '';
  let providerId: string | null = null;
  let model: string | null = null;
  try {
    assertRequestBodySize(request, 84_000_000);
    const { user, supabase } = await requireUser();
    userId = user.id;
    const body = validateAnalyzeImageRequest(await request.json());
    if (body.images.some(image => image.data.length > 14_000_000)) throw gatewayError('INVALID_REQUEST', 'An image payload is too large', 413);
    if (body.images.reduce((total, image) => total + image.data.length, 0) > 72_000_000) throw gatewayError('INVALID_REQUEST', 'Combined image payload is too large', 413);
    const provider = await getOwnedProvider(body.providerId, user.id);
    providerId = provider.id;
    if (!provider.image_capable) throw gatewayError('FORBIDDEN', 'Provider does not support image analysis', 403);
    model = resolveModel(provider, body.model, 'image');
    const result = parseJsonObject(await callVisionProvider(provider, model, body.images, prompt(body)));
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
