import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { isUuid } from '@/lib/social';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

export async function GET(request: Request, context: { params: Promise<{ publicId: string }> }) {
  const requestId = rid();
  try {
    const { supabase } = await requireUser();
    const publicId = (await context.params).publicId;
    if (!isUuid(publicId)) return out(requestId, 404, { code: 'AUTHOR_NOT_FOUND', message: 'Author not found' });
    const sort = new URL(request.url).searchParams.get('sort') === 'liked' ? 'liked' : 'newest';
    const { data: author, error: authorError } = await supabase.from('authors').select('id, is_system').eq('public_id', publicId).maybeSingle();
    if (authorError || !author) return out(requestId, 404, { code: 'AUTHOR_NOT_FOUND', message: 'Author not found' });

    if (author.is_system) {
      const { data: registered, error } = await supabase.from('system_cards').select('card_key, title, title_zh, category, created_at').eq('author_id', author.id);
      if (error) return out(requestId, 500, { code: 'AUTHOR_CARDS_FAILED', message: 'Unable to load author cards' });
      const keys = (registered || []).map((card) => card.card_key);
      const { data: metrics } = keys.length ? await supabase.rpc('get_card_interactions', { target_keys: keys }) : { data: {} };
      const interactions = metrics && typeof metrics === 'object' ? metrics as Record<string, Record<string, unknown>> : {};
      const cards = (registered || []).map((card) => ({
        id: card.card_key,
        title: card.title,
        titleZh: card.title_zh,
        category: card.category,
        likeCount: Number(interactions[card.card_key]?.likeCount || 0),
        likedByViewer: Boolean(interactions[card.card_key]?.likedByViewer),
        isSystem: true,
      }));
      if (sort === 'liked') cards.sort((a, b) => b.likeCount - a.likeCount);
      else cards.sort((a, b) => a.id.localeCompare(b.id));
      return out(requestId, 200, cards);
    }

    const { data: cards, error } = await supabase
      .from('aesthetic_cards')
      .select('id, title, title_zh, category, summary, palette, style_tags, updated_at, card_images(url, storage_path, sort_order)')
      .eq('author_id', author.id)
      .eq('visibility', 'public')
      .eq('publish_status', 'published')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) return out(requestId, 500, { code: 'AUTHOR_CARDS_FAILED', message: 'Unable to load author cards' });

    const ids = (cards || []).map((card) => card.id);
    const { data: metrics } = ids.length ? await supabase.rpc('get_card_interactions', { target_keys: ids }) : { data: {} };
    const interactions = metrics && typeof metrics === 'object' ? metrics as Record<string, Record<string, unknown>> : {};
    const result = await Promise.all((cards || []).map(async (card) => {
      const images = Array.isArray(card.card_images) ? [...card.card_images].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)) : [];
      const first = images[0];
      const image = first?.storage_path ? (await supabase.storage.from('card-images').createSignedUrl(first.storage_path, 3600)).data?.signedUrl || '' : first?.url || '';
      return {
        id: card.id,
        title: card.title,
        titleZh: card.title_zh,
        category: card.category,
        summary: card.summary,
        palette: card.palette,
        styleTags: card.style_tags,
        image,
        updatedAt: card.updated_at,
        likeCount: Number(interactions[card.id]?.likeCount || 0),
        likedByViewer: Boolean(interactions[card.id]?.likedByViewer),
        isSystem: false,
      };
    }));
    if (sort === 'liked') result.sort((a, b) => b.likeCount - a.likeCount);
    return out(requestId, 200, result);
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === 'UNAUTHENTICATED';
    return out(requestId, unauthenticated ? 401 : 500, { code: unauthenticated ? 'UNAUTHENTICATED' : 'AUTHOR_CARDS_FAILED', message: unauthenticated ? 'Sign in required' : 'Unable to load author cards' });
  }
}
