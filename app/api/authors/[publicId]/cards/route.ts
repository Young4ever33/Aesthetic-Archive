import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

export async function GET(request: Request, context: { params: Promise<{ publicId: string }> }) {
  const requestId = rid();
  try {
    const { user } = await requireUser();
    const publicId = (await context.params).publicId;
    const url = new URL(request.url);
    const sort = url.searchParams.get('sort') === 'liked' ? 'liked' : 'newest';
    const admin = createSupabaseAdminClient();
    const { data: author } = await admin.from('authors').select('id, is_system').eq('public_id', publicId).maybeSingle();
    if (!author) return out(requestId, 404, { code: 'AUTHOR_NOT_FOUND', message: 'Author not found' });

    if (author.is_system) {
      const { data: registered } = await admin.from('system_cards').select('card_key, title, title_zh, category, created_at').eq('author_id', author.id);
      const keys = (registered || []).map((card) => card.card_key);
      const [{ data: likes }, { data: mine }] = await Promise.all([
        keys.length ? admin.from('card_likes').select('system_card_key').in('system_card_key', keys) : Promise.resolve({ data: [] }),
        keys.length ? admin.from('card_likes').select('system_card_key').eq('user_id', user.id).in('system_card_key', keys) : Promise.resolve({ data: [] }),
      ]);
      const counts = new Map<string, number>();
      (likes || []).forEach((like) => counts.set(like.system_card_key, (counts.get(like.system_card_key) || 0) + 1));
      const liked = new Set((mine || []).map((like) => like.system_card_key));
      const cards = (registered || []).map((card) => ({ id: card.card_key, title: card.title, titleZh: card.title_zh, category: card.category, likeCount: counts.get(card.card_key) || 0, likedByViewer: liked.has(card.card_key), isSystem: true }));
      if (sort === 'liked') cards.sort((a, b) => b.likeCount - a.likeCount);
      else cards.sort((a, b) => a.id.localeCompare(b.id));
      return out(requestId, 200, cards);
    }

    const { data: cards, error } = await admin.from('aesthetic_cards').select('id, title, title_zh, category, summary, palette, style_tags, updated_at, card_images(url, storage_path, sort_order)').eq('author_id', author.id).eq('visibility', 'public').eq('publish_status', 'published').order('updated_at', { ascending: false }).limit(100);
    if (error) return out(requestId, 500, { code: 'AUTHOR_CARDS_FAILED', message: 'Unable to load author cards' });
    const ids = (cards || []).map((card) => card.id);
    const [{ data: likes }, { data: mine }] = await Promise.all([
      ids.length ? admin.from('card_likes').select('card_id').in('card_id', ids) : Promise.resolve({ data: [] }),
      ids.length ? admin.from('card_likes').select('card_id').eq('user_id', user.id).in('card_id', ids) : Promise.resolve({ data: [] }),
    ]);
    const counts = new Map<string, number>();
    (likes || []).forEach((like) => counts.set(like.card_id, (counts.get(like.card_id) || 0) + 1));
    const liked = new Set((mine || []).map((like) => like.card_id));
    const result = await Promise.all((cards || []).map(async (card) => {
      const images = Array.isArray(card.card_images) ? [...card.card_images].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)) : [];
      const first = images[0];
      const image = first?.storage_path ? (await admin.storage.from('card-images').createSignedUrl(first.storage_path, 3600)).data?.signedUrl || '' : first?.url || '';
      return { id: card.id, title: card.title, titleZh: card.title_zh, category: card.category, summary: card.summary, palette: card.palette, styleTags: card.style_tags, image, updatedAt: card.updated_at, likeCount: counts.get(card.id) || 0, likedByViewer: liked.has(card.id), isSystem: false };
    }));
    if (sort === 'liked') result.sort((a, b) => b.likeCount - a.likeCount);
    return out(requestId, 200, result);
  } catch (error) {
    return out(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'AUTHOR_CARDS_FAILED', message: 'Unable to load author cards' });
  }
}
