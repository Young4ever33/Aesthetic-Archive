import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
const kinds = new Set(['feedback', 'report']);
const targetTypes = new Set(['card', 'board', 'provider', 'app']);
function requestId() { return `req_${crypto.randomUUID()}`; }
function out(id: string, status: number, value: unknown) { return NextResponse.json({ requestId: id, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

export async function GET() {
  const id = requestId();
  try {
    const { supabase, user } = await requireUser();
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const query = supabase.from('user_feedback').select('id, owner_id, kind, target_type, target_id, message, status, created_at, resolved_at').order('created_at', { ascending: false }).limit(100);
    const { data, error } = profile?.role === 'admin' ? await query : await query.eq('owner_id', user.id);
    if (error) return out(id, 500, { code: 'FEEDBACK_QUERY_FAILED', message: 'Unable to load feedback' });
    return out(id, 200, data || []);
  } catch { return out(id, 401, { code: 'UNAUTHENTICATED', message: 'Sign in required' }); }
}

export async function POST(request: Request) {
  const id = requestId();
  try {
    let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createSupabaseServerClient>> | ReturnType<typeof createSupabaseAdminClient>;
    let ownerId: string | null = null;
    try {
      const session = await requireUser();
      supabase = session.supabase;
      ownerId = session.user.id;
    } catch {
      supabase = await createSupabaseAdminClient();
    }
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 20_000) return out(id, 413, { code: 'REQUEST_TOO_LARGE', message: 'Feedback request is too large' });
    const body = await request.json() as Record<string, unknown>;
    const kind = typeof body.kind === 'string' && kinds.has(body.kind) ? body.kind : 'feedback';
    const targetType = typeof body.targetType === 'string' && targetTypes.has(body.targetType) ? body.targetType : 'app';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length < 5 || message.length > 10_000) return out(id, 400, { code: 'INVALID_REQUEST', message: 'message must be between 5 and 10000 characters' });
    const targetId = typeof body.targetId === 'string' && /^[0-9a-f-]{36}$/i.test(body.targetId) ? body.targetId : null;
    const { data, error } = await supabase.from('user_feedback').insert({ owner_id: ownerId, kind, target_type: targetType, target_id: targetId, message }).select('id, kind, target_type, target_id, message, status, created_at').single();
    if (error) return out(id, 500, { code: 'FEEDBACK_CREATE_FAILED', message: 'Unable to save feedback' });
    return out(id, 201, data);
  } catch { return out(id, 401, { code: 'UNAUTHENTICATED', message: 'Sign in required' }); }
}

export async function PATCH(request: Request) {
  const id = requestId();
  try {
    const { supabase, user } = await requireUser();
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return out(id, 403, { code: 'FORBIDDEN', message: 'Admin access required' });
    const feedbackId = new URL(request.url).searchParams.get('id');
    const body = await request.json() as Record<string, unknown>;
    const status = body.status;
    if (!feedbackId || !['open', 'reviewing', 'resolved', 'dismissed'].includes(String(status))) return out(id, 400, { code: 'INVALID_REQUEST', message: 'Valid id and status are required' });
    const { data, error } = await supabase.from('user_feedback').update({ status, resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null }).eq('id', feedbackId).select('id, status, resolved_at').single();
    if (error) return out(id, 404, { code: 'FEEDBACK_NOT_FOUND', message: 'Feedback not found' });
    return out(id, 200, data);
  } catch { return out(id, 401, { code: 'UNAUTHENTICATED', message: 'Sign in required' }); }
}
