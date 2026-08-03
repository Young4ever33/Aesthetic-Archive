import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { callTextProvider, getOwnedProvider, probeProvider, providerMeta, resolveModel } from '@/lib/ai-gateway';
import { logAiUsage } from '@/lib/ai-usage';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  const startedAt = Date.now();
  let userId = '';
  let providerId: string | null = null;
  let model: string | null = null;
  try {
    const { user, supabase } = await requireUser();
    userId = user.id;
    const body = await request.json() as { providerId?: unknown; model?: unknown };
    if (typeof body.providerId !== 'string') return NextResponse.json({ requestId, error: { code: 'INVALID_REQUEST', message: 'providerId is required' } }, { status: 400 });
    const provider = await getOwnedProvider(body.providerId, user.id);
    providerId = provider.id;
    const hasTextModel = Array.isArray(provider.text_models) && provider.text_models.some((item) => typeof item === 'string' && item.trim());
    if (hasTextModel || typeof body.model === 'string' && body.model.trim()) {
      model = resolveModel(provider, body.model, 'text');
      const text = await callTextProvider(provider, model, 'Reply with one short sentence confirming that this Provider connection is reachable.');
      if (!text.trim()) throw new Error('Provider responded without text');
      await logAiUsage(supabase, { ownerId: userId, providerId, route: '/api/providers/test', model, status: 'success', requestId, durationMs: Date.now() - startedAt });
      return NextResponse.json({ requestId, data: { connected: true, capability: 'text', preview: text.trim().slice(0, 160) }, meta: providerMeta(provider, model) });
    }
    const modelCount = await probeProvider(provider);
    await logAiUsage(supabase, { ownerId: userId, providerId, route: '/api/providers/test', model: null, status: 'success', requestId, durationMs: Date.now() - startedAt });
    return NextResponse.json({ requestId, data: { connected: true, capability: 'authentication', modelCount, preview: 'Provider credentials and API endpoint are reachable.' }, meta: providerMeta(provider, 'authentication-probe') });
  } catch (error) {
    if (userId) {
      const { supabase } = await requireUser().catch(() => ({ supabase: null as never }));
      if (supabase) await logAiUsage(supabase, { ownerId: userId, providerId, route: '/api/providers/test', model, status: 'error', requestId, error: error instanceof Error ? error.message : 'unknown', durationMs: Date.now() - startedAt });
    }
    const known = error as { code?: string; message?: string; status?: number; retryable?: boolean };
    return NextResponse.json({ requestId, error: { code: known.code || 'INTERNAL_ERROR', message: known.message || 'Provider test failed', retryable: known.retryable || false } }, { status: known.status || 500 });
  }
}
