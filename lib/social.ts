import type { SupabaseClient } from '@supabase/supabase-js';

export type CardTarget = { cardId: string | null; systemCardKey: string | null };

export type AuthorRecord = {
  id: string;
  public_id: string;
  profile_id: string;
  slug: string;
  display_name: string;
  avatar_url: string | null;
  identity_label: string;
  bio: string | null;
  design_focus: string | null;
  is_system: boolean;
};

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function ensureAuthorForCurrentUser(supabase: SupabaseClient): Promise<AuthorRecord> {
  const { data, error } = await supabase.rpc('ensure_current_author');
  if (error || !data || typeof data !== 'object') throw new Error('AUTHOR_CREATE_FAILED');
  return data as AuthorRecord;
}

export async function actorPublicProfiles(supabase: SupabaseClient, actorIds: string[]) {
  const unique = [...new Set(actorIds.filter(Boolean))];
  if (!unique.length) return new Map<string, { publicId: string; name: string; avatar: string }>();
  const { data } = await supabase.from('authors').select('profile_id, public_id, display_name, avatar_url').in('profile_id', unique);
  return new Map((data || []).map((author) => [author.profile_id, {
    publicId: author.public_id,
    name: author.display_name,
    avatar: author.avatar_url || '',
  }]));
}
