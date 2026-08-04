import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { ensureAuthorForCurrentUser } from '@/lib/social';
import { getAccountRole } from '@/lib/review-access';

export const runtime = 'nodejs';

function rid() {
  return `req_${crypto.randomUUID()}`;
}

function out(requestId: string, status: number, value: unknown) {
  return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status });
}

function isUnauthenticated(error: unknown) {
  return error instanceof Error && error.message === 'UNAUTHENTICATED';
}

export async function GET() {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, language, role, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      return out(requestId, 500, { code: 'PROFILE_QUERY_FAILED', message: 'Unable to load profile' });
    }

    // A social profile must not prevent an authenticated user from loading their account.
    let author: Awaited<ReturnType<typeof ensureAuthorForCurrentUser>> | null = null;
    try {
      author = await ensureAuthorForCurrentUser(supabase);
    } catch (authorError) {
      console.error('PROFILE_AUTHOR_UNAVAILABLE', { requestId, message: authorError instanceof Error ? authorError.message : 'unknown' });
    }

    let role = profile.role;
    try {
      role = await getAccountRole(user.id);
    } catch (roleError) {
      console.error('PROFILE_ROLE_UNAVAILABLE', { requestId, message: roleError instanceof Error ? roleError.message : 'unknown' });
    }

    return out(requestId, 200, {
      ...profile,
      role,
      email: user.email ?? null,
      public_id: author?.public_id ?? null,
      bio: author?.bio || '',
      design_focus: author?.design_focus || '',
      author_ready: Boolean(author),
    });
  } catch (error) {
    return out(requestId, isUnauthenticated(error) ? 401 : 500, {
      code: isUnauthenticated(error) ? 'UNAUTHENTICATED' : 'PROFILE_LOAD_FAILED',
      message: isUnauthenticated(error) ? 'Sign in required' : 'Unable to load profile',
    });
  }
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
      updated_at: new Date().toISOString(),
    };
    Object.keys(updates).forEach((key) => {
      if (updates[key as keyof typeof updates] === undefined) delete updates[key as keyof typeof updates];
    });

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id, display_name, avatar_url, language, role, created_at, updated_at')
      .single();

    if (error || !profile) {
      return out(requestId, 500, { code: 'PROFILE_UPDATE_FAILED', message: 'Unable to update profile' });
    }

    let author: Awaited<ReturnType<typeof ensureAuthorForCurrentUser>> | null = null;
    let authorReady = true;
    try {
      author = await ensureAuthorForCurrentUser(supabase);
      const authorUpdates = {
        bio: typeof body.bio === 'string' ? body.bio.trim().slice(0, 500) : author.bio,
        design_focus: typeof body.specialty === 'string' ? body.specialty.trim().slice(0, 300) : author.design_focus,
        updated_at: new Date().toISOString(),
      };
      const { data: updatedAuthor, error: authorError } = await supabase
        .from('authors')
        .update(authorUpdates)
        .eq('id', author.id)
        .eq('profile_id', user.id)
        .select('public_id, bio, design_focus')
        .single();
      if (authorError || !updatedAuthor) throw new Error('AUTHOR_PROFILE_UPDATE_FAILED');
      author = { ...author, ...updatedAuthor };
    } catch (authorError) {
      authorReady = false;
      console.error('PROFILE_AUTHOR_UPDATE_UNAVAILABLE', { requestId, message: authorError instanceof Error ? authorError.message : 'unknown' });
    }

    let role = profile.role;
    try {
      role = await getAccountRole(user.id);
    } catch (roleError) {
      console.error('PROFILE_ROLE_UNAVAILABLE', { requestId, message: roleError instanceof Error ? roleError.message : 'unknown' });
    }

    return out(requestId, 200, {
      ...profile,
      role,
      public_id: author?.public_id ?? null,
      bio: author?.bio || '',
      design_focus: author?.design_focus || '',
      author_ready: authorReady,
    });
  } catch (error) {
    return out(requestId, isUnauthenticated(error) ? 401 : 500, {
      code: isUnauthenticated(error) ? 'UNAUTHENTICATED' : 'PROFILE_UPDATE_FAILED',
      message: isUnauthenticated(error) ? 'Sign in required' : 'Unable to update profile',
    });
  }
}
