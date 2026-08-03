import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ensureAuthorForProfile } from '@/lib/social';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

export async function GET() {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from('profiles').select('id, display_name, avatar_url, language, role, created_at, updated_at').eq('id', user.id).single();
    if (error) return out(requestId, 500, { code: 'PROFILE_QUERY_FAILED', message: 'Unable to load profile' });
    const author = await ensureAuthorForProfile(user.id);
    return out(requestId, 200, { ...data, email: user.email ?? null, public_id: author.public_id, bio: author.bio || '', design_focus: author.design_focus || '' });
  } catch { return out(requestId, 401, { code: 'UNAUTHENTICATED', message: 'Sign in required' }); }
}

export async function PATCH(request: Request) {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json() as Record<string, unknown>;
    const updates = {
      display_name: typeof body.name === 'string' ? body.name.trim().slice(0, 120) : undefined,
      avatar_url: typeof body.avatar === 'string' ? body.avatar.trim().slice(0, 2000) : undefined,
      language: body.language === 'en' ? 'en' : 'zh-CN',
      updated_at: new Date().toISOString()
    };
    Object.keys(updates).forEach(key => { if (updates[key as keyof typeof updates] === undefined) delete updates[key as keyof typeof updates]; });
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select('id, display_name, avatar_url, language, role, created_at, updated_at').single();
    if (error) return out(requestId, 500, { code: 'PROFILE_UPDATE_FAILED', message: 'Unable to update profile' });
    const author = await ensureAuthorForProfile(user.id);
    const authorUpdates = {
      bio: typeof body.bio === 'string' ? body.bio.trim().slice(0, 500) : author.bio,
      design_focus: typeof body.specialty === 'string' ? body.specialty.trim().slice(0, 300) : author.design_focus,
      updated_at: new Date().toISOString(),
    };
    const { data: updatedAuthor, error: authorError } = await createSupabaseAdminClient().from('authors').update(authorUpdates).eq('id', author.id).eq('profile_id', user.id).select('public_id, bio, design_focus').single();
    if (authorError) return out(requestId, 500, { code: 'AUTHOR_PROFILE_UPDATE_FAILED', message: 'Unable to update public author profile' });
    return out(requestId, 200, { ...data, ...updatedAuthor });
  } catch { return out(requestId, 401, { code: 'UNAUTHENTICATED', message: 'Sign in required' }); }
}
