import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type AccountRole = 'user' | 'reviewer' | 'admin';

export async function getAccountRole(userId: string): Promise<AccountRole> {
  const admin = await createSupabaseAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) throw new Error('PROFILE_ROLE_QUERY_FAILED');
  return data.role === 'admin' || data.role === 'reviewer' ? data.role : 'user';
}

export async function requireReviewRole(userId: string): Promise<'reviewer' | 'admin'> {
  const role = await getAccountRole(userId);
  if (role !== 'admin' && role !== 'reviewer') throw new Error('FORBIDDEN');
  return role;
}
