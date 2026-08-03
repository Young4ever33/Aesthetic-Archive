import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { assertRequestBodySize, MAX_JSON_BODY_BYTES } from '@/lib/validation';
import { callImageGenerationProvider, gatewayError, getOwnedProvider, providerMeta, resolveModel } from '@/lib/ai-gateway';
import { logAiUsage } from '@/lib/ai-usage';

export const runtime = 'nodejs';
const SIZES = new Set(['1024x1024', '1536x1024', '1024x1536']);
function failure(requestId: string, error: unknown) {
  const known = error as { code?: string; message?: string; retryable?: boolean; status?: number };
  return NextResponse.json({ requestId, error: { code: known.code || 'INTERNAL_ERROR', message: known.message || 'Unable to generate image', retryable: known.retryable || false } }, { status: known.status || 500 });
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
    const body = await request.json() as { providerId?: unknown; model?: unknown; prompt?: unknown; negativePrompt?: unknown; count?: unknown; size?: unknown };
    if (typeof body.providerId !== 'string' || typeof body.prompt !== 'string') throw gatewayError('INVALID_REQUEST', 'providerId and prompt are required', 400);
    const prompt = body.prompt.trim();
    const negative = typeof body.negativePrompt === 'string' ? body.negativePrompt.trim() : '';
    if (prompt.length < 80 || prompt.length > 12_000 || negative.length > 4_000) throw gatewayError('INVALID_REQUEST', 'Prompt length is invalid', 400);
    const count = Math.min(4, Math.max(1, Number(body.count) || 1));
    const size = typeof body.size === 'string' && SIZES.has(body.size) ? body.size as '1024x1024' | '1536x1024' | '1024x1536' : '1536x1024';
    const provider = await getOwnedProvider(body.providerId, user.id);
    providerId = provider.id;
    model = resolveModel(provider, body.model, 'generation');
    const finalPrompt = negative ? `${prompt}\n\nAvoid: ${negative}` : prompt;
    const images = await callImageGenerationProvider(provider, model, finalPrompt, { count, size });
    await logAiUsage(supabase, { ownerId: userId, providerId, route: '/api/ai/generate-image', model, status: 'success', requestId, durationMs: Date.now() - startedAt });
    return NextResponse.json({ requestId, data: { images }, meta: providerMeta(provider, model) });
  } catch (error) {
    if (userId) {
      const { supabase } = await requireUser().catch(() => ({ supabase: null as never }));
      if (supabase) await logAiUsage(supabase, { ownerId: userId, providerId, route: '/api/ai/generate-image', model, status: 'error', requestId, error: error instanceof Error ? error.message : 'unknown', durationMs: Date.now() - startedAt });
    }
    return failure(requestId, error);
  }
}
