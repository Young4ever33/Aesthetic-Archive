import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireReviewRole } from '@/lib/review-access';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

async function requireReviewer() {
  const { user } = await requireUser();
  const role = await requireReviewRole(user.id);
  return { user, role };
}

export async function GET() {
  const requestId = rid();
  try {
    const { user } = await requireReviewer();
    const admin = await createSupabaseAdminClient();
    const { data, error } = await admin
      .from('aesthetic_cards')
      .select('*')
      .in('publish_status', ['pending', 'rejected'])
      .neq('owner_id', user.id)
      .order('updated_at', { ascending: true })
      .limit(100);
    if (error) {
      console.error('REVIEW_CARDS_QUERY_FAILED', { requestId, code: error.code, message: error.message });
      return out(requestId, 500, { code: 'REVIEW_QUERY_FAILED', message: 'Unable to load review queue', stage: 'cards', databaseCode: error.code || null });
    }
    const cards = data || [];
    const cardIds = cards.map(card => card.id);
    if (!cardIds.length) return out(requestId, 200, []);
    type ReviewImage = { id: string; card_id: string; url: string | null; storage_path: string | null; alt: string | null; sort_order: number | null };
    type PublishReview = { id: string; card_id: string; owner_id: string; reviewer_id: string | null; status: string; note: string | null; reviewed_at: string | null };
    const [{ data: reviews, error: reviewsError }, { data: images, error: imagesError }] = await Promise.all([
      admin.from('publish_reviews').select('id, card_id, owner_id, reviewer_id, status, note, reviewed_at').in('card_id', cardIds).order('reviewed_at', { ascending: true }),
      admin.from('card_images').select('id, card_id, url, storage_path, alt, sort_order').in('card_id', cardIds).order('sort_order', { ascending: true }),
    ]);
    if (reviewsError || imagesError) {
      console.error('REVIEW_ATTACHMENTS_QUERY_FAILED', { requestId, reviewsCode: reviewsError?.code, reviewsMessage: reviewsError?.message, imagesCode: imagesError?.code, imagesMessage: imagesError?.message });
    }
    const reviewsByCard = new Map<string, PublishReview[]>();
    (reviewsError ? [] : reviews || []).forEach(review => reviewsByCard.set(review.card_id, [...(reviewsByCard.get(review.card_id) || []), review]));
    const imagesByCard = new Map<string, ReviewImage[]>();
    (imagesError ? [] : images || []).forEach(image => imagesByCard.set(image.card_id, [...(imagesByCard.get(image.card_id) || []), image]));
    const cardsWithAttachments = await Promise.all(cards.map(async card => ({
      ...card,
      publish_reviews: reviewsByCard.get(card.id) || [],
      card_images: await Promise.all((imagesByCard.get(card.id) || []).map(async image => ({
        ...image,
        url: image.storage_path
          ? await admin.storage.from('card-images').createSignedUrl(image.storage_path, 3600).then(result => result.data?.signedUrl || image.url).catch(() => image.url)
          : image.url,
      }))),
    })));
    return out(requestId, 200, cardsWithAttachments);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    const code = status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : 'REVIEW_QUERY_FAILED';
    console.error('REVIEW_ROUTE_FAILED', { requestId, errorType: error instanceof Error ? error.name : 'UnknownError' });
    return out(requestId, status, { code, message: status === 401 ? 'Sign in required' : status === 403 ? 'Reviewer access required' : 'Unable to load review queue', ...(status === 500 ? { stage: 'route' } : {}) });
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
    const admin = await createSupabaseAdminClient();
    const { data: card, error: cardError } = await admin.from('aesthetic_cards').select('id, owner_id, title, title_zh, publish_status, visibility, reviewed_at').eq('id', cardId).single();
    if (cardError || !card) return out(requestId, 404, { code: 'CARD_NOT_FOUND', message: 'Review card not found' });
    if (card.owner_id === user.id) return out(requestId, 403, { code: 'SELF_REVIEW_FORBIDDEN', message: 'Reviewers cannot review their own cards' });
    if (!['pending', 'rejected'].includes(card.publish_status)) return out(requestId, 409, { code: 'INVALID_REVIEW_STATE', message: 'Card is not awaiting review' });
    const nextStatus = body.action === 'approve' ? 'published' : 'rejected';
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 4000) : null;
    const { error: updateError } = await admin.from('aesthetic_cards').update({ publish_status: nextStatus, visibility: 'public', reviewed_at: new Date().toISOString() }).eq('id', cardId);
    if (updateError) return out(requestId, 500, { code: 'REVIEW_UPDATE_FAILED', message: 'Unable to update card review status' });
    const { data: audit, error: reviewError } = await admin.from('publish_reviews').insert({ card_id: cardId, owner_id: card.owner_id, status: nextStatus, reviewer_id: user.id, note, reviewed_at: new Date().toISOString() }).select('id').single();
    if (reviewError || !audit) {
      await admin.from('aesthetic_cards').update({ publish_status: card.publish_status, visibility: card.visibility, reviewed_at: card.reviewed_at }).eq('id', cardId);
      return out(requestId, 500, { code: 'REVIEW_AUDIT_FAILED', message: 'Review was not completed because the audit record could not be saved' });
    }
    const { error: notificationError } = await admin.from('notifications').insert({ recipient_id: card.owner_id, actor_id: user.id, type: nextStatus === 'published' ? 'card_published' : 'card_rejected', card_id: cardId, payload: { cardTitle: card.title_zh || card.title, note } });
    if (notificationError) {
      await Promise.all([
        admin.from('publish_reviews').delete().eq('id', audit.id),
        admin.from('aesthetic_cards').update({ publish_status: card.publish_status, visibility: card.visibility, reviewed_at: card.reviewed_at }).eq('id', cardId),
      ]);
      return out(requestId, 500, { code: 'REVIEW_NOTIFICATION_FAILED', message: 'Review was not completed because the author notification could not be saved' });
    }
    return out(requestId, 200, { id: cardId, status: nextStatus, reviewerRole: role });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    const code = status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : 'REVIEW_FAILED';
    return out(requestId, status, { code, message: status === 401 ? 'Sign in required' : status === 403 ? 'Reviewer access required' : 'Unable to process review' });
  }
}
