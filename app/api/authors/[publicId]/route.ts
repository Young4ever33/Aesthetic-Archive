import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

export async function GET(_request: Request, context: { params: Promise<{ publicId: string }> }) {
  const requestId = rid();
  try {
    const { user } = await requireUser();
    const publicId = (await context.params).publicId;
    const admin = createSupabaseAdminClient();
    const { data: author, error } = await admin.from('authors').select('id, public_id, profile_id, slug, display_name, avatar_url, identity_label, bio, design_focus, is_system, created_at').eq('public_id', publicId).maybeSingle();
    if (error || !author) return out(requestId, 404, { code: 'AUTHOR_NOT_FOUND', message: 'Author not found' });
    const [{ count: followerCount }, { count: followingCount }, { count: cardCount }, { data: follow }] = await Promise.all([
      admin.from('author_follows').select('id', { count: 'exact', head: true }).eq('author_id', author.id),
      author.profile_id ? admin.from('authors').select('id').eq('profile_id', author.profile_id).maybeSingle().then(async () => admin.from('author_follows').select('id', { count: 'exact', head: true }).eq('follower_id', author.profile_id)) : Promise.resolve({ count: 0 }),
      admin.from('aesthetic_cards').select('id', { count: 'exact', head: true }).eq('author_id', author.id).eq('visibility', 'public').eq('publish_status', 'published'),
      admin.from('author_follows').select('id').eq('author_id', author.id).eq('follower_id', user.id).maybeSingle(),
    ]);
    const { count: systemCardCount } = await admin.from('system_cards').select('card_key', { count: 'exact', head: true }).eq('author_id', author.id);
    return out(requestId, 200, {
      publicId: author.public_id,
      slug: author.slug,
      name: author.display_name,
      avatar: author.avatar_url || '',
      identity: author.identity_label,
      bio: author.bio || '',
      designFocus: author.design_focus || '',
      isSystem: author.is_system,
      isSelf: author.profile_id === user.id,
      following: Boolean(follow),
      followerCount: followerCount || 0,
      followingCount: followingCount || 0,
      cardCount: (cardCount || 0) + (systemCardCount || 0),
    });
  } catch (error) {
    return out(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'AUTHOR_QUERY_FAILED', message: 'Unable to load author' });
  }
}
