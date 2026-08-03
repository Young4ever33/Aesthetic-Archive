import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

async function requireReviewer() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role;
  if (role !== 'admin' && role !== 'reviewer') throw new Error('FORBIDDEN');
  return { user, role };
}

export async function GET() {
  const requestId = rid();
  try {
    await requireReviewer();
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('aesthetic_cards').select('*, publish_reviews(*)').in('publish_status', ['pending', 'rejected']).order('updated_at', { ascending: true }).limit(100);
    if (error) return out(requestId, 500, { code: 'REVIEW_QUERY_FAILED', message: 'Unable to load review queue' });
    return out(requestId, 200, data || []);
  } catch (error) {
    return out(requestId, error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401, { code: error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHENTICATED', message: error instanceof Error && error.message === 'FORBIDDEN' ? 'Reviewer access required' : 'Sign in required' });
  }
}

export async function POST(request: Request) {
  const requestId = rid();
  try {
    const { user, role } = await requireReviewer();
    const cardId = new URL(request.url).searchParams.get('id');
    if (!cardId) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'Card id is required' });
    const body = await request.json().catch(() => ({})) as { action?: string; note?: string };
    if (body.action !== 'approve' && body.action !== 'reject') return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'Action must be approve or reject' });
    const admin = createSupabaseAdminClient();
    const { data: card, error: cardError } = await admin.from('aesthetic_cards').select('id, owner_id, title, title_zh, publish_status').eq('id', cardId).single();
    if (cardError || !card) return out(requestId, 404, { code: 'CARD_NOT_FOUND', message: 'Review card not found' });
    if (!['pending', 'rejected'].includes(card.publish_status)) return out(requestId, 409, { code: 'INVALID_REVIEW_STATE', message: 'Card is not awaiting review' });
    const nextStatus = body.action === 'approve' ? 'published' : 'rejected';
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 4000) : null;
    const { error: updateError } = await admin.from('aesthetic_cards').update({ publish_status: nextStatus, visibility: body.action === 'approve' ? 'public' : 'private', reviewed_at: new Date().toISOString() }).eq('id', cardId);
    if (updateError) return out(requestId, 500, { code: 'REVIEW_UPDATE_FAILED', message: 'Unable to update card review status' });
    const { error: reviewError } = await admin.from('publish_reviews').insert({ card_id: cardId, owner_id: card.owner_id, status: nextStatus, reviewer_id: user.id, note, reviewed_at: new Date().toISOString() });
    if (reviewError) return out(requestId, 500, { code: 'REVIEW_AUDIT_FAILED', message: 'Card status changed but audit record failed' });
    const { error: notificationError } = await admin.from('notifications').insert({ recipient_id: card.owner_id, actor_id: user.id, type: nextStatus === 'published' ? 'card_published' : 'card_rejected', card_id: cardId, payload: { cardTitle: card.title_zh || card.title, note } });
    return out(requestId, 200, { id: cardId, status: nextStatus, reviewerRole: role, ...(notificationError ? { notificationWarning: true } : {}) });
  } catch (error) {
    return out(requestId, error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401, { code: error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHENTICATED', message: error instanceof Error && error.message === 'FORBIDDEN' ? 'Reviewer access required' : 'Sign in required' });
  }
}
