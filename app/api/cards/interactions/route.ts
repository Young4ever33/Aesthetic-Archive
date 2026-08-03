import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/social';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  try {
    const { user } = await requireUser();
    const keys = [...new Set((new URL(request.url).searchParams.get('keys') || '').split(',').map((key) => key.trim()).filter(Boolean))].slice(0, 100);
    if (!keys.length) return NextResponse.json({ requestId, data: {} });
    const cardIds = keys.filter(isUuid);
    const systemKeys = keys.filter((key) => !isUuid(key));
    const admin = createSupabaseAdminClient();
    const [{ data: cardLikes }, { data: systemLikes }, { data: myCardLikes }, { data: mySystemLikes }, { data: systemCards }, { data: cards }] = await Promise.all([
      cardIds.length ? admin.from('card_likes').select('card_id').in('card_id', cardIds) : Promise.resolve({ data: [] }),
      systemKeys.length ? admin.from('card_likes').select('system_card_key').in('system_card_key', systemKeys) : Promise.resolve({ data: [] }),
      cardIds.length ? admin.from('card_likes').select('card_id').eq('user_id', user.id).in('card_id', cardIds) : Promise.resolve({ data: [] }),
      systemKeys.length ? admin.from('card_likes').select('system_card_key').eq('user_id', user.id).in('system_card_key', systemKeys) : Promise.resolve({ data: [] }),
      systemKeys.length ? admin.from('system_cards').select('card_key, author_id, authors(public_id, display_name, avatar_url, identity_label, is_system)').in('card_key', systemKeys) : Promise.resolve({ data: [] }),
      cardIds.length ? admin.from('aesthetic_cards').select('id, owner_id, author_id, authors(public_id, display_name, avatar_url, identity_label, is_system)').in('id', cardIds) : Promise.resolve({ data: [] }),
    ]);
    const counts = new Map<string, number>();
    (cardLikes || []).forEach((like) => { if (like.card_id) counts.set(like.card_id, (counts.get(like.card_id) || 0) + 1); });
    (systemLikes || []).forEach((like) => { if (like.system_card_key) counts.set(like.system_card_key, (counts.get(like.system_card_key) || 0) + 1); });
    const liked = new Set<string>();
    (myCardLikes || []).forEach((like) => { if (like.card_id) liked.add(like.card_id); });
    (mySystemLikes || []).forEach((like) => { if (like.system_card_key) liked.add(like.system_card_key); });
    const result: Record<string, unknown> = {};
    const authorValue = (value: unknown) => Array.isArray(value) ? value[0] : value;
    (systemCards || []).forEach((card) => { const author = authorValue(card.authors) as Record<string, unknown> | null; result[card.card_key] = { likedByViewer: liked.has(card.card_key), likeCount: counts.get(card.card_key) || 0, ownCard: false, author: author ? { publicId: author.public_id, name: author.display_name, avatar: author.avatar_url || '', role: 'curator', identity: author.identity_label, isSystem: true } : null }; });
    (cards || []).forEach((card) => { const author = authorValue(card.authors) as Record<string, unknown> | null; result[card.id] = { likedByViewer: liked.has(card.id), likeCount: counts.get(card.id) || 0, ownCard: card.owner_id === user.id, author: author ? { publicId: author.public_id, name: author.display_name, avatar: author.avatar_url || '', role: 'user', identity: author.identity_label, isSystem: false } : null }; });
    return NextResponse.json({ requestId, data: result });
  } catch (error) {
    return NextResponse.json({ requestId, error: { code: error instanceof Error && error.message === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'INTERACTIONS_QUERY_FAILED', message: 'Unable to load card interactions' } }, { status: error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500 });
  }
}
