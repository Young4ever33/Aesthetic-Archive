import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { validateGeneratePromptRequest, ContractValidationError } from '@/lib/validation';
import { callTextProvider, getOwnedProvider, gatewayError, parseJsonObject, providerMeta, resolveModel } from '@/lib/ai-gateway';
import { logAiUsage } from '@/lib/ai-usage';
import { assertRequestBodySize, MAX_JSON_BODY_BYTES } from '@/lib/validation';

export const runtime = 'nodejs';

function failure(requestId: string, error: unknown) {
  const known = error as { code?: string; message?: string; retryable?: boolean; status?: number };
  const status = known.status || (error instanceof ContractValidationError ? 400 : 500);
  return NextResponse.json({ requestId, error: { code: known.code || (error instanceof ContractValidationError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR'), message: known.message || 'Unable to generate Prompt', retryable: known.retryable || false } }, { status });
}

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  const startedAt = Date.now();
  let userId = '';
  let providerId: string | null = null;
  let model: string | null = null;
  try {
    assertRequestBodySize(request, MAX_JSON_BODY_BYTES);
    const { user, supabase } = await requireUser();
    userId = user.id;
    const body = validateGeneratePromptRequest(await request.json());
    const provider = await getOwnedProvider(body.providerId, user.id);
    providerId = provider.id;
    model = resolveModel(provider, body.model, 'text');
    const serializedCard = JSON.stringify(body.card).slice(0, 30_000);
    const text = await callTextProvider(provider, model, `Create bilingual image-generation Prompts from this structured aesthetic card. Return ONLY valid JSON with promptZh, promptEn, negativePromptZh, negativePromptEn, reviewNotes, confidence. promptZh and promptEn must describe the same one concrete representative scene and be directly runnable without user input. Lock subject quantity and relations, foreground/midground/background, one camera position and lens character, lighting direction and color temperature, material surfaces and joints, dominant/support/accent color proportions, and final texture. Put likely model-drift boundaries in the positive Prompts as well as the negative Prompts. Do not use placeholders, bracketed fill-in fields, variable lists, "user-provided subject", "replace with", use-case metadata, research notes, quality slogans, model parameters, or unsupported attribution. Never invent a designer, architect, public figure, brand, location, date, software, or provenance. Keep Chinese and English isolated: promptZh and negativePromptZh use Chinese only; promptEn and negativePromptEn use English only. Both negative Prompts must specifically exclude relevant structural, anatomical, typographic, palette, material, identity, text, logo, and watermark failures. The returned Prompts must already generate controlled images even though users may edit them later. Card: ${serializedCard}`);
    const result = parseJsonObject(text);
    await logAiUsage(supabase, { ownerId: userId, providerId, route: '/api/ai/generate-prompt', model, status: 'success', requestId, durationMs: Date.now() - startedAt });
    return NextResponse.json({ requestId, data: result, meta: providerMeta(provider, model, body.templateId, body.templateVersion) });
  } catch (error) {
    if (userId) {
      const { supabase } = await requireUser().catch(() => ({ supabase: null as never }));
      if (supabase) await logAiUsage(supabase, { ownerId: userId, providerId, route: '/api/ai/generate-prompt', model, status: 'error', requestId, error: error instanceof Error ? error.message : 'unknown', durationMs: Date.now() - startedAt });
    }
    return failure(requestId, error);
  }
}
