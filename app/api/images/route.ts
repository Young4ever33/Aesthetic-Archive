import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
const MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX = 10 * 1024 * 1024;
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

export async function POST(request: Request) {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const form = await request.formData();
    const file = form.get('file');
    const cardId = String(form.get('cardId') || '');
    if (!(file instanceof File) || !cardId) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'file and cardId are required' });
    if (!MIME.has(file.type) || file.size > MAX) return out(requestId, 413, { code: 'INVALID_IMAGE', message: 'Only JPEG, PNG, and WebP images up to 10MB are supported' });
    const { data: card } = await supabase.from('aesthetic_cards').select('id').eq('id', cardId).eq('owner_id', user.id).single();
    if (!card) return out(requestId, 404, { code: 'CARD_NOT_FOUND', message: 'Card not found' });
    const extension = file.type.split('/')[1].replace('jpeg', 'jpg');
    const path = `${user.id}/${cardId}/${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage.from('card-images').upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) return out(requestId, 500, { code: 'IMAGE_UPLOAD_FAILED', message: 'Unable to upload image' });
    const { data: image, error } = await supabase.from('card_images').insert({ card_id: cardId, owner_id: user.id, storage_path: path, url: path, mime_type: file.type, alt: file.name, sort_order: 0 }).select('id, card_id, storage_path, mime_type, alt, sort_order, created_at').single();
    if (error) return out(requestId, 500, { code: 'IMAGE_RECORD_FAILED', message: 'Unable to save image metadata' });
    const signed = await supabase.storage.from('card-images').createSignedUrl(path, 3600);
    return out(requestId, 201, { ...image, signedUrl: signed.data?.signedUrl || null });
  } catch (error) { return out(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'IMAGE_UPLOAD_FAILED', message: 'Unable to upload image' }); }
}

export async function GET(request: Request) {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const cardId = new URL(request.url).searchParams.get('cardId');
    if (!cardId) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'cardId is required' });
    const { data, error } = await supabase.from('card_images').select('id, card_id, storage_path, mime_type, alt, sort_order, created_at').eq('card_id', cardId).eq('owner_id', user.id).order('sort_order');
    if (error) return out(requestId, 500, { code: 'IMAGE_QUERY_FAILED', message: 'Unable to load images' });
    const images = await Promise.all((data || []).map(async image => ({ ...image, signedUrl: (await supabase.storage.from('card-images').createSignedUrl(image.storage_path, 3600)).data?.signedUrl || null })));
    return out(requestId, 200, images);
  } catch { return out(requestId, 401, { code: 'UNAUTHENTICATED', message: 'Sign in required' }); }
}
