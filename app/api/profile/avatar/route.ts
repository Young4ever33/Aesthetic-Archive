import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
const MIME = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const MAX_BYTES = 2 * 1024 * 1024;
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  try {
    const { supabase, user } = await requireUser();
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'Avatar file is required' });
    const extension = MIME.get(file.type);
    if (!extension || file.size === 0 || file.size > MAX_BYTES) return out(requestId, 413, { code: 'INVALID_AVATAR', message: 'Only JPEG, PNG, and WebP avatars up to 2MB are supported' });
    const path = `${user.id}/avatar.${extension}`;
    const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: true });
    if (uploadError) return out(requestId, 500, { code: 'AVATAR_UPLOAD_FAILED', message: 'Unable to upload avatar' });
    const publicUrl = supabase.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl;
    const versionedUrl = `${publicUrl}?v=${Date.now()}`;
    const { data, error } = await supabase.from('profiles').update({ avatar_url: versionedUrl, updated_at: new Date().toISOString() }).eq('id', user.id).select('id, avatar_url').single();
    if (error) return out(requestId, 500, { code: 'AVATAR_PROFILE_UPDATE_FAILED', message: 'Avatar uploaded but profile update failed' });
    return out(requestId, 200, { avatar: data.avatar_url });
  } catch (error) {
    return out(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'AVATAR_UPLOAD_FAILED', message: 'Unable to upload avatar' });
  }
}
