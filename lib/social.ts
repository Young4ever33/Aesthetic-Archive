import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type CardTarget = { cardId: string | null; systemCardKey: string | null };

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function ensureAuthorForProfile(profileId: string) {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin.from('authors').select('id, public_id, profile_id, slug, display_name, avatar_url, identity_label, bio, design_focus, is_system').eq('profile_id', profileId).maybeSingle();
  if (existing) return existing;
  const { data: profile, error: profileError } = await admin.from('profiles').select('id, display_name, avatar_url, role').eq('id', profileId).single();
  if (profileError || !profile) throw new Error('PROFILE_NOT_FOUND');
  const { data, error } = await admin.from('authors').insert({
    profile_id: profileId,
    slug: `member-${profileId.replaceAll('-', '')}`,
    display_name: profile.display_name?.trim() || 'Aesthetic Archive Member',
    avatar_url: profile.avatar_url || null,
    identity_label: profile.role === 'admin' ? '管理员' : profile.role === 'reviewer' ? '审核员' : '创作者',
  }).select('id, public_id, profile_id, slug, display_name, avatar_url, identity_label, bio, design_focus, is_system').single();
  if (error || !data) throw new Error('AUTHOR_CREATE_FAILED');
  return data;
}

export async function actorPublicProfiles(actorIds: string[]) {
  const admin = createSupabaseAdminClient();
  const unique = [...new Set(actorIds.filter(Boolean))];
  if (!unique.length) return new Map<string, { publicId: string; name: string; avatar: string }>();
  const { data } = await admin.from('authors').select('profile_id, public_id, display_name, avatar_url').in('profile_id', unique);
  return new Map((data || []).map((author) => [author.profile_id, {
    publicId: author.public_id,
    name: author.display_name,
    avatar: author.avatar_url || '',
  }]));
}
