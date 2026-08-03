import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ensureAuthorForProfile } from '@/lib/social';

export const runtime = 'nodejs';

const publicColumns = 'id, owner_id, author_id, source, title, title_zh, category, visibility, publish_status, summary, cultural_background, design_elements, palette, style_tags, material_tags, space_tags, scenario_tags, composition, use_cases, prompt_zh, prompt_en, negative_prompt, reviewed_at, created_at, updated_at, authors(public_id, display_name, avatar_url, identity_label, is_system), card_images(id, url, storage_path, alt, sort_order, width, height, mime_type)';
const arrayFields = ['palette', 'style_tags', 'material_tags', 'space_tags', 'scenario_tags'] as const;

function response(requestId: string, status: number, data: unknown) {
  return NextResponse.json({ requestId, ...(status >= 400 ? { error: data } : { data }) }, { status });
}
function id() { return `req_${crypto.randomUUID()}`; }
async function withSignedImages<T extends Record<string, unknown>>(cards: T[], viewerId: string, includeOwnerMetrics = false) {
  const admin = createSupabaseAdminClient();
  const cardIds = cards.map((card) => card.id).filter((value): value is string => typeof value === 'string');
  const [{ data: allLikes }, { data: viewerLikes }, { data: saves }] = await Promise.all([
    cardIds.length ? admin.from('card_likes').select('card_id').in('card_id', cardIds) : Promise.resolve({ data: [] }),
    cardIds.length ? admin.from('card_likes').select('card_id').eq('user_id', viewerId).in('card_id', cardIds) : Promise.resolve({ data: [] }),
    includeOwnerMetrics && cardIds.length ? admin.from('saved_cards').select('card_id').in('card_id', cardIds) : Promise.resolve({ data: [] }),
  ]);
  const likeCounts = new Map<string, number>();
  (allLikes || []).forEach((like) => { if (like.card_id) likeCounts.set(like.card_id, (likeCounts.get(like.card_id) || 0) + 1); });
  const liked = new Set((viewerLikes || []).map((like) => like.card_id));
  const saveCounts = new Map<string, number>();
  (saves || []).forEach((save) => { if (save.card_id) saveCounts.set(save.card_id, (saveCounts.get(save.card_id) || 0) + 1); });

  return Promise.all(cards.map(async card => {
    const rawImages = Array.isArray(card['card_images']) ? card['card_images'] : [];
    const images = await Promise.all(rawImages
      .filter((image): image is Record<string, unknown> => Boolean(image && typeof image === 'object' && typeof image.storage_path === 'string'))
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
      .map(async image => ({
        ...image,
        signedUrl: (await admin.storage.from('card-images').createSignedUrl(String(image.storage_path), 3600)).data?.signedUrl || null
      })));
    const gallery = images.map(image => image.signedUrl).filter((url): url is string => Boolean(url));
    const rawAuthor = Array.isArray(card.authors) ? card.authors[0] : card.authors;
    const authorRecord = rawAuthor && typeof rawAuthor === 'object' ? rawAuthor as Record<string, unknown> : null;
    const author = authorRecord ? {
      publicId: typeof authorRecord.public_id === 'string' ? authorRecord.public_id : '',
      name: typeof authorRecord.display_name === 'string' && authorRecord.display_name.trim() ? authorRecord.display_name.trim() : 'Aesthetic Archive Member',
      avatar: typeof authorRecord.avatar_url === 'string' ? authorRecord.avatar_url : '',
      role: authorRecord.is_system ? 'curator' : 'user',
      identity: typeof authorRecord.identity_label === 'string' ? authorRecord.identity_label : '创作者',
      isSystem: Boolean(authorRecord.is_system),
    } : null;
    const cardId = typeof card.id === 'string' ? card.id : '';
    const { card_images: _cardImages, authors: _authors, ...rest } = card;
    return { ...rest, image: gallery[0] || '', gallery, author, likeCount: likeCounts.get(cardId) || 0, likedByViewer: liked.has(cardId), ownCard: card.owner_id === viewerId, ...(includeOwnerMetrics && card.owner_id === viewerId ? { savedCount: saveCounts.get(cardId) || 0 } : {}) };
  }));
}

function fields(body: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  const map: Record<string, string> = { title: 'title', titleZh: 'title_zh', category: 'category', visibility: 'visibility', summary: 'summary', culturalBackground: 'cultural_background', designElements: 'design_elements', composition: 'composition', useCases: 'use_cases', promptZh: 'prompt_zh', promptEn: 'prompt_en', negativePrompt: 'negative_prompt', source: 'source' };
  Object.entries(map).forEach(([from, to]) => { if (typeof body[from] === 'string') output[to] = String(body[from]).slice(0, 50000); });
  arrayFields.forEach((key) => { const camel = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase()); if (Array.isArray(body[camel])) output[key] = body[camel]; else if (Array.isArray(body[key])) output[key] = body[key]; });
  return output;
}

export async function GET(request: Request) {
  const requestId = id();
  try {
    const { supabase, user } = await requireUser();
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') || 'mine';
    let query = supabase.from('aesthetic_cards').select(publicColumns).order('updated_at', { ascending: false }).limit(100);
    if (scope === 'public') query = query.eq('visibility', 'public').eq('publish_status', 'published');
    else query = query.eq('owner_id', user.id);
    const { data, error } = await query;
    if (error) return response(requestId, 500, { code: 'CARD_QUERY_FAILED', message: 'Unable to load cards' });
    return response(requestId, 200, await withSignedImages((data || []) as Record<string, unknown>[], user.id, scope !== 'public'));
  } catch (error) {
    return response(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'UNAUTHENTICATED', message: 'Sign in required' });
  }
}

export async function POST(request: Request) {
  const requestId = id();
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.title !== 'string' || body.title.trim().length < 2) return response(requestId, 400, { code: 'INVALID_REQUEST', message: 'title is required' });
    const data = fields(body);
    const author = await ensureAuthorForProfile(user.id);
    data.owner_id = user.id;
    data.author_id = author.id;
    data.source = typeof data.source === 'string' ? data.source : 'private';
    data.visibility = data.visibility === 'public' ? 'public' : 'private';
    data.publish_status = data.visibility === 'public' ? 'pending' : 'private';
    const { data: card, error } = await supabase.from('aesthetic_cards').insert(data).select(publicColumns).single();
    if (error) return response(requestId, 500, { code: 'CARD_SAVE_FAILED', message: 'Unable to save card' });
    return response(requestId, 201, (await withSignedImages([card as Record<string, unknown>], user.id, true))[0]);
  } catch (error) {
    if (error instanceof SyntaxError) return response(requestId, 400, { code: 'INVALID_REQUEST', message: 'Invalid JSON body' });
    return response(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'CARD_SAVE_FAILED', message: 'Unable to save card' });
  }
}

export async function PATCH(request: Request) {
  const requestId = id();
  try {
    const { supabase, user } = await requireUser();
    const cardId = new URL(request.url).searchParams.get('id');
    if (!cardId) return response(requestId, 400, { code: 'INVALID_REQUEST', message: 'Card id is required' });
    const data = fields(await request.json() as Record<string, unknown>);
    delete data.visibility;
    if (Object.keys(data).length === 0) return response(requestId, 400, { code: 'INVALID_REQUEST', message: 'No card changes supplied' });
    const { data: card, error } = await supabase.from('aesthetic_cards').update(data).eq('id', cardId).eq('owner_id', user.id).select(publicColumns).single();
    if (error) return response(requestId, 500, { code: 'CARD_UPDATE_FAILED', message: 'Unable to update card' });
    return response(requestId, 200, (await withSignedImages([card as Record<string, unknown>], user.id, true))[0]);
  } catch (error) {
    return response(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'CARD_UPDATE_FAILED', message: 'Unable to update card' });
  }
}

export async function DELETE(request: Request) {
  const requestId = id();
  try {
    const { supabase, user } = await requireUser();
    const cardId = new URL(request.url).searchParams.get('id');
    if (!cardId) return response(requestId, 400, { code: 'INVALID_REQUEST', message: 'Card id is required' });
    const { error } = await supabase.from('aesthetic_cards').delete().eq('id', cardId).eq('owner_id', user.id);
    if (error) return response(requestId, 500, { code: 'CARD_DELETE_FAILED', message: 'Unable to delete card' });
    return response(requestId, 200, { deleted: true });
  } catch (error) {
    return response(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'CARD_DELETE_FAILED', message: 'Unable to delete card' });
  }
}
