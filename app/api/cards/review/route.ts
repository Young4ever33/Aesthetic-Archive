import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
const transitions: Record<string, string[]> = { private: ['pending'], pending: ['rejected', 'published'], rejected: ['pending'], approved: ['published', 'unpublished'], published: ['unpublished'], unpublished: ['pending'] };
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

export async function POST(request: Request) {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json() as { cardId?: string; action?: string; note?: string };
    if (!body.cardId || !body.action) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'cardId and action are required' });
    const { data: card, error: cardError } = await supabase.from('aesthetic_cards').select('id, owner_id, publish_status, visibility').eq('id', body.cardId).single();
    if (cardError || !card) return out(requestId, 404, { code: 'CARD_NOT_FOUND', message: 'Card not found' });
    const reviewerRole = await supabase.from('profiles').select('role').eq('id', user.id).single().then(({ data }) => data?.role || 'user');
    const isReviewer = reviewerRole === 'admin' || reviewerRole === 'reviewer';
    const target = body.action === 'submit' ? 'pending' : body.action === 'approve' || body.action === 'publish' ? 'published' : body.action === 'reject' ? 'rejected' : 'unpublished';
    if (!transitions[card.publish_status]?.includes(target)) return out(requestId, 409, { code: 'INVALID_TRANSITION', message: `Cannot move card from ${card.publish_status} to ${target}` });
    if (body.action !== 'submit' && !isReviewer) return out(requestId, 403, { code: 'FORBIDDEN', message: 'Only reviewers can perform this action' });
    if (body.action === 'submit' && card.owner_id !== user.id) return out(requestId, 403, { code: 'FORBIDDEN', message: 'Only the owner can submit this card' });
    const client = isReviewer ? createSupabaseAdminClient() : supabase;
    const { data: updated, error } = await client.from('aesthetic_cards').update({ publish_status: target, visibility: target === 'published' ? 'public' : card.visibility, reviewed_at: isReviewer ? new Date().toISOString() : null }).eq('id', body.cardId).select('id, publish_status, visibility, reviewed_at').single();
    if (error) return out(requestId, 500, { code: 'REVIEW_UPDATE_FAILED', message: 'Unable to update review status' });
    await client.from('publish_reviews').insert({ card_id: body.cardId, owner_id: card.owner_id, reviewer_id: isReviewer ? user.id : null, status: target, note: body.note || null, reviewed_at: isReviewer ? new Date().toISOString() : null });
    if (isReviewer && ['published', 'rejected', 'unpublished'].includes(target)) {
      const notificationType = target === 'published' ? 'card_published' : target === 'rejected' ? 'card_rejected' : 'card_unpublished';
      await client.from('notifications').insert({ recipient_id: card.owner_id, actor_id: user.id, type: notificationType, card_id: body.cardId, payload: { note: String(body.note || '').slice(0, 1000) } });
    }
    return out(requestId, 200, updated);
  } catch (error) { return out(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'REVIEW_FAILED', message: 'Unable to process review' }); }
}
