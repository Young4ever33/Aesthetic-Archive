import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAccountRole } from '@/lib/review-access';

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
    if (!['submit', 'approve', 'publish', 'reject', 'unpublish'].includes(body.action)) return out(requestId, 400, { code: 'INVALID_ACTION', message: 'Unsupported review action' });
    const isSubmit = body.action === 'submit';
    const reviewerRole = isSubmit ? 'user' : await getAccountRole(user.id);
    const isReviewer = reviewerRole === 'admin' || reviewerRole === 'reviewer';
    if (!isSubmit && !isReviewer) return out(requestId, 403, { code: 'FORBIDDEN', message: 'Only reviewers can perform this action' });
    const client = isReviewer ? await createSupabaseAdminClient() : supabase;
    let cardQuery = client.from('aesthetic_cards').select('id, owner_id, publish_status, visibility, reviewed_at').eq('id', body.cardId);
    if (isSubmit) cardQuery = cardQuery.eq('owner_id', user.id);
    const { data: card, error: cardError } = await cardQuery.single();
    if (cardError || !card) return out(requestId, 404, { code: 'CARD_NOT_FOUND', message: 'Card not found' });
    const target = isSubmit ? 'pending' : body.action === 'approve' || body.action === 'publish' ? 'published' : body.action === 'reject' ? 'rejected' : 'unpublished';
    if (!transitions[card.publish_status]?.includes(target)) return out(requestId, 409, { code: 'INVALID_TRANSITION', message: `Cannot move card from ${card.publish_status} to ${target}` });
    if (!isSubmit && card.owner_id === user.id) return out(requestId, 403, { code: 'SELF_REVIEW_FORBIDDEN', message: 'Reviewers cannot review their own cards' });
    const reviewedAt = isReviewer ? new Date().toISOString() : null;
    const nextVisibility = target === 'published' || target === 'pending' || target === 'rejected' ? 'public' : 'private';
    const { data: updated, error } = await client.from('aesthetic_cards').update({ publish_status: target, visibility: nextVisibility, reviewed_at: reviewedAt }).eq('id', body.cardId).select('id, publish_status, visibility, reviewed_at').single();
    if (error) return out(requestId, 500, { code: 'REVIEW_UPDATE_FAILED', message: 'Unable to update review status' });
    const { data: audit, error: auditError } = await client.from('publish_reviews').insert({ card_id: body.cardId, owner_id: card.owner_id, reviewer_id: isReviewer ? user.id : null, status: target, note: body.note || null, reviewed_at: reviewedAt }).select('id').single();
    if (auditError || !audit) {
      await client.from('aesthetic_cards').update({ publish_status: card.publish_status, visibility: card.visibility, reviewed_at: card.reviewed_at }).eq('id', body.cardId);
      return out(requestId, 500, { code: 'REVIEW_AUDIT_FAILED', message: 'Review was not completed because the audit record could not be saved' });
    }
    if (isReviewer && ['published', 'rejected', 'unpublished'].includes(target)) {
      const notificationType = target === 'published' ? 'card_published' : target === 'rejected' ? 'card_rejected' : 'card_unpublished';
      const { error: notificationError } = await client.from('notifications').insert({ recipient_id: card.owner_id, actor_id: user.id, type: notificationType, card_id: body.cardId, payload: { note: String(body.note || '').slice(0, 1000) } });
      if (notificationError) {
        await Promise.all([
          client.from('publish_reviews').delete().eq('id', audit.id),
          client.from('aesthetic_cards').update({ publish_status: card.publish_status, visibility: card.visibility, reviewed_at: card.reviewed_at }).eq('id', body.cardId),
        ]);
        return out(requestId, 500, { code: 'REVIEW_NOTIFICATION_FAILED', message: 'Review was not completed because the author notification could not be saved' });
      }
    }
    return out(requestId, 200, updated);
  } catch (error) { return out(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'REVIEW_FAILED', message: 'Unable to process review' }); }
}
