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
    const text = await callTextProvider(provider, model, `Create a bilingual image-generation Prompt from this structured aesthetic card. Return ONLY valid JSON with promptZh, promptEn, negativePrompt, reviewNotes, confidence. Both promptZh and promptEn must be complete and directly runnable without user input. Choose one concrete representative test subject from the card, then lock its quantity and spatial relation, foreground/midground/background, camera position and lens character, lighting direction and color temperature, material surface and joints, dominant/support/accent color proportions, and final texture. Do not use placeholders, bracketed fill-in fields, variable lists, "user-provided subject", "replace with", use-case metadata, research notes, model parameters, or unsupported attribution. Keep Chinese and English language content isolated. The user may later edit the concrete subject, but the returned Prompt itself must already generate a controlled image. negativePrompt must be separate and specific to failures that would break the reference style, composition, palette, or material logic. Card: ${serializedCard}`);
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
