import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/social';

export const runtime = 'nodejs';

type Target = {
  key: string;
  authorId: string | null;
  ownerId: string | null;
};

export async function GET(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  try {
    const { user } = await requireUser();
    const admin = await createSupabaseAdminClient();
    const keys = [...new Set((new URL(request.url).searchParams.get('keys') || '')
      .split(',')
      .map((key) => key.trim())
      .filter((key) => isUuid(key) || /^[A-Z]-[0-9]{2}$/.test(key)))]
      .slice(0, 100);
    if (!keys.length) return NextResponse.json({ requestId, data: {} });

    const uuidKeys = keys.filter(isUuid);
    const systemKeys = keys.filter((key) => !isUuid(key));
    const [{ data: cards, error: cardsError }, { data: systemCards, error: systemError }] = await Promise.all([
      uuidKeys.length
        ? admin.from('aesthetic_cards').select('id, author_id, owner_id').in('id', uuidKeys).eq('visibility', 'public').eq('publish_status', 'published')
        : Promise.resolve({ data: [], error: null }),
      systemKeys.length
        ? admin.from('system_cards').select('card_key, author_id').in('card_key', systemKeys)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (cardsError || systemError) {
      console.error('INTERACTIONS_TARGETS_FAILED', { requestId, cardsCode: cardsError?.code, systemCode: systemError?.code });
      return NextResponse.json({ requestId, error: { code: 'INTERACTIONS_QUERY_FAILED', message: 'Unable to load card interactions' } }, { status: 500 });
    }

    const targets: Target[] = [
      ...(cards || []).map((card) => ({ key: card.id, authorId: card.author_id, ownerId: card.owner_id })),
      ...(systemCards || []).map((card) => ({ key: card.card_key, authorId: card.author_id, ownerId: null })),
    ];
    const authorIds = [...new Set(targets.map((target) => target.authorId).filter((value): value is string => Boolean(value)))];
    const [{ data: authors }, { data: cardLikes }, { data: systemLikes }] = await Promise.all([
      authorIds.length ? admin.from('authors').select('id, public_id, display_name, avatar_url, identity_label, is_system').in('id', authorIds) : Promise.resolve({ data: [] }),
      uuidKeys.length ? admin.from('card_likes').select('card_id, user_id').in('card_id', uuidKeys) : Promise.resolve({ data: [] }),
      systemKeys.length ? admin.from('card_likes').select('system_card_key, user_id').in('system_card_key', systemKeys) : Promise.resolve({ data: [] }),
    ]);
    const authorsById = new Map((authors || []).map((author) => [author.id, author]));
    const likes = [...(cardLikes || []).map((like) => ({ key: like.card_id, userId: like.user_id })), ...(systemLikes || []).map((like) => ({ key: like.system_card_key, userId: like.user_id }))];
    const data = Object.fromEntries(targets.map((target) => {
      const targetLikes = likes.filter((like) => like.key === target.key);
      const author = target.authorId ? authorsById.get(target.authorId) : null;
      return [target.key, {
        likedByViewer: targetLikes.some((like) => like.userId === user.id),
        likeCount: targetLikes.length,
        ownCard: target.ownerId === user.id,
        author: author ? { publicId: author.public_id, name: author.display_name, avatar: author.avatar_url || '', role: author.is_system ? 'curator' : 'user', identity: author.identity_label, isSystem: author.is_system } : null,
      }];
    }));
    return NextResponse.json({ requestId, data });
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === 'UNAUTHENTICATED';
    return NextResponse.json({ requestId, error: { code: unauthenticated ? 'UNAUTHENTICATED' : 'INTERACTIONS_QUERY_FAILED', message: unauthenticated ? 'Sign in required' : 'Unable to load card interactions' } }, { status: unauthenticated ? 401 : 500 });
  }
}
