import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireReviewRole } from '@/lib/review-access';

export const runtime = 'nodejs';
const rid = () => `req_${crypto.randomUUID()}`;
const out = (requestId: string, status: number, value: unknown) => NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status });

async function reviewer() { const { user } = await requireUser(); const role = await requireReviewRole(user.id); return { user, role }; }

export async function GET() {
  const requestId = rid();
  try {
    await reviewer();
    const admin = await createSupabaseAdminClient();
    const { data: tickets, error } = await admin.from('user_feedback').select('id, owner_id, kind, target_type, target_id, message, status, created_at, resolved_at').order('created_at', { ascending: false }).limit(100);
    if (error) return out(requestId, 500, { code: 'FEEDBACK_QUERY_FAILED', message: 'Unable to load feedback' });
    const ids = (tickets || []).map(ticket => ticket.id);
    const { data: messages } = ids.length ? await admin.from('feedback_messages').select('id, feedback_id, sender_id, sender_role, message, created_at').in('feedback_id', ids).order('created_at', { ascending: true }) : { data: [] };
    return out(requestId, 200, (tickets || []).map(ticket => ({ ...ticket, messages: (messages || []).filter(message => message.feedback_id === ticket.id) })));
  } catch (error) {
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401;
    return out(requestId, status, { code: status === 403 ? 'FORBIDDEN' : 'UNAUTHENTICATED', message: status === 403 ? 'Reviewer access required' : 'Sign in required' });
  }
}

export async function PATCH(request: Request) {
  const requestId = rid();
  try {
    const { user, role } = await reviewer();
    const feedbackId = new URL(request.url).searchParams.get('id');
    const body = await request.json().catch(() => ({})) as { status?: string; message?: string };
    if (!feedbackId) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'Feedback id is required' });
    const admin = await createSupabaseAdminClient();
    if (body.status && ['open', 'reviewing', 'resolved', 'dismissed'].includes(body.status)) {
      const { error } = await admin.from('user_feedback').update({ status: body.status, resolved_at: body.status === 'resolved' || body.status === 'dismissed' ? new Date().toISOString() : null }).eq('id', feedbackId);
      if (error) return out(requestId, 404, { code: 'FEEDBACK_NOT_FOUND', message: 'Feedback not found' });
    }
    const reply = typeof body.message === 'string' ? body.message.trim().slice(0, 10_000) : '';
    if (reply) {
      const { data: ticket } = await admin.from('user_feedback').select('owner_id').eq('id', feedbackId).single();
      if (!ticket) return out(requestId, 404, { code: 'FEEDBACK_NOT_FOUND', message: 'Feedback not found' });
      const { error: messageError } = await admin.from('feedback_messages').insert({ feedback_id: feedbackId, sender_id: user.id, sender_role: role, message: reply });
      const notificationResult = ticket.owner_id
        ? await admin.from('notifications').insert({ recipient_id: ticket.owner_id, actor_id: user.id, type: 'feedback_reply', feedback_id: feedbackId, payload: { message: reply } })
        : { error: null };
      if (messageError || notificationResult.error) return out(requestId, 500, { code: 'FEEDBACK_REPLY_FAILED', message: 'Unable to deliver feedback reply' });
    }
    return out(requestId, 200, { id: feedbackId, updated: true });
  } catch (error) {
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401;
    return out(requestId, status, { code: status === 403 ? 'FORBIDDEN' : 'UNAUTHENTICATED', message: status === 403 ? 'Reviewer access required' : 'Sign in required' });
  }
}
