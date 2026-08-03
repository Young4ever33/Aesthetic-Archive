import type { SupabaseClient } from '@supabase/supabase-js';

export async function logAiUsage(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    providerId?: string | null;
    route: string;
    model?: string | null;
    status: 'success' | 'error';
    error?: string | null;
    requestId?: string;
    durationMs?: number;
  },
) {
  const { error } = await supabase.from('ai_usage_logs').insert({
    owner_id: input.ownerId,
    provider_id: input.providerId || null,
    route: input.route,
    model: input.model || null,
    status: input.status,
    error: input.error ? input.error.slice(0, 500) : null,
    request_id: input.requestId || null,
    duration_ms: typeof input.durationMs === 'number' ? Math.min(300_000, Math.max(0, Math.round(input.durationMs))) : null,
  });
  if (error) console.warn('Unable to write AI usage log:', error.message);
}
