import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/social';

export const runtime = 'nodejs';

function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) {
  return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status });
}

function normalizeLikeTarget(value: string) {
  const trimmed = value.trim();
  if (isUuid(trimmed)) return trimmed;
  const seedKey = trimmed.match(/^([A-Z]-[0-9]{2})(?:$|[-_])/i)?.[1];
  return seedKey ? seedKey.toUpperCase() : trimmed;
}

async function resolveLikeTarget(cardId: string) {
  const normalized = normalizeLikeTarget(cardId);
  if (/^[A-Z]-[0-9]{2}$/.test(normalized) || isUuid(normalized)) return normalized;
  const admin = await createSupabaseAdminClient();
  const { data } = await admin.from('system_cards').select('card_key, title, title_zh');
  const requested = cardId.trim().toLowerCase();
  const match = (data || []).find(card => [card.card_key, card.title, card.title_zh]
    .some(value => String(value || '').trim().toLowerCase() === requested));
  return match?.card_key || normalized;
}

async function toggle(cardId: string, shouldLike: boolean) {
  const requestId = rid();
  let targetKey = normalizeLikeTarget(cardId);
  try {
    const { user } = await requireUser();
    const admin = await createSupabaseAdminClient();
    targetKey = await resolveLikeTarget(cardId);

    const uuidTarget = isUuid(targetKey);
    const targetQuery = uuidTarget
      ? admin.from('aesthetic_cards').select('id, author_id, owner_id, title, title_zh, visibility, publish_status').eq('id', targetKey).maybeSingle()
      : admin.from('system_cards').select('card_key, author_id, title, title_zh').eq('card_key', targetKey).maybeSingle();
    const { data: target, error: targetError } = await targetQuery;
    if (targetError || !target) {
      console.error('LIKE_TARGET_QUERY_FAILED', { requestId, targetKey, databaseCode: targetError?.code });
      return out(requestId, 404, { code: 'CARD_NOT_FOUND', message: 'Card not found', normalizedTarget: targetKey, databaseCode: targetError?.code || null });
    }
    if (uuidTarget && ('visibility' in target) && (target.visibility !== 'public' || target.publish_status !== 'published')) {
      return out(requestId, 404, { code: 'CARD_NOT_PUBLIC', message: 'Only published public cards can be liked', normalizedTarget: targetKey });
    }
    if (uuidTarget && 'owner_id' in target && target.owner_id === user.id) {
      return out(requestId, 403, { code: 'OWN_CARD_LIKE_FORBIDDEN', message: 'You cannot like your own card', normalizedTarget: targetKey });
    }

    const targetColumn = uuidTarget ? 'card_id' : 'system_card_key';
    const authorId = target.author_id;
    const existingQuery = admin.from('card_likes').select('id').eq('user_id', user.id).eq(targetColumn, targetKey).maybeSingle();
    const { data: existing, error: existingError } = await existingQuery;
    if (existingError) throw new Error(`LIKE_LOOKUP_FAILED:${existingError.code || 'database'}`);

    let insertedLikeId: string | null = null;
    if (shouldLike && !existing) {
      const { data: inserted, error: insertError } = await admin.from('card_likes').insert({
        user_id: user.id,
        author_id: authorId,
        card_id: uuidTarget ? targetKey : null,
        system_card_key: uuidTarget ? null : targetKey,
      }).select('id').single();
      if (insertError) throw new Error(`LIKE_INSERT_FAILED:${insertError.code || 'database'}`);
      insertedLikeId = inserted.id;
    } else if (!shouldLike && existing) {
      const { error: deleteError } = await admin.from('card_likes').delete().eq('id', existing.id);
      if (deleteError) throw new Error(`LIKE_DELETE_FAILED:${deleteError.code || 'database'}`);
    }

    if (insertedLikeId) {
      const { data: author } = await admin.from('authors').select('profile_id, is_system').eq('id', authorId).maybeSingle();
      let recipientIds: string[] = [];
      if (author?.is_system) {
        const { data: reviewers, error: reviewersError } = await admin.from('profiles').select('id').in('role', ['reviewer', 'admin']);
        if (reviewersError) console.error('SYSTEM_LIKE_RECIPIENTS_FAILED', { requestId, databaseCode: reviewersError.code });
        recipientIds = (reviewers || []).map((profile) => profile.id);
      } else if (author?.profile_id && author.profile_id !== user.id) {
        recipientIds = [author.profile_id];
      }
      if (recipientIds.length) {
        const title = ('title_zh' in target && target.title_zh) || target.title || '';
        const notifications = recipientIds.map((recipientId) => ({
          recipient_id: recipientId,
          actor_id: user.id,
          type: 'card_liked',
          card_id: uuidTarget ? targetKey : null,
          system_card_key: uuidTarget ? null : targetKey,
          author_id: authorId,
          like_id: insertedLikeId,
          payload: { cardTitle: title, systemCard: Boolean(author?.is_system) },
        }));
        const { error: notificationError } = await admin.from('notifications').insert(notifications);
        if (notificationError) console.error('LIKE_NOTIFICATION_FAILED', { requestId, databaseCode: notificationError.code });
      }
    }

    const { count, error: countError } = await admin.from('card_likes').select('id', { count: 'exact', head: true }).eq(targetColumn, targetKey);
    if (countError) throw new Error(`LIKE_COUNT_FAILED:${countError.code || 'database'}`);
    return out(requestId, 200, { liked: shouldLike, likeCount: count || 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const unauthenticated = message === 'UNAUTHENTICATED';
    const databaseCode = message.includes(':') ? message.split(':').at(-1) : null;
    console.error('LIKE_ROUTE_FAILED', { requestId, cardId, targetKey, errorType: message.split(':')[0] });
    return out(requestId, unauthenticated ? 401 : 500, {
      code: unauthenticated ? 'UNAUTHENTICATED' : 'LIKE_UPDATE_FAILED',
      message: unauthenticated ? 'Sign in required' : 'Unable to update Like',
      normalizedTarget: targetKey,
      databaseCode,
    });
  }
}

export async function POST(_request: Request, context: { params: Promise<{ cardId: string }> }) {
  return toggle(decodeURIComponent((await context.params).cardId), true);
}

export async function DELETE(_request: Request, context: { params: Promise<{ cardId: string }> }) {
  return toggle(decodeURIComponent((await context.params).cardId), false);
}
