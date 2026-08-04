import { createClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/server-env';

export function createSupabaseAdminClient() {
  const url = getServerEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getServerEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase admin environment is not configured');
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
