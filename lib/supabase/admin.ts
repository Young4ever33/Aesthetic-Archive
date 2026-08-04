import { createClient } from '@supabase/supabase-js';
import { getServerEnvAsync } from '@/lib/server-env';

export async function createSupabaseAdminClient() {
  const [url, serviceRoleKey] = await Promise.all([
    getServerEnvAsync('NEXT_PUBLIC_SUPABASE_URL'),
    getServerEnvAsync('SUPABASE_SERVICE_ROLE_KEY'),
  ]);

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase admin environment is not configured');
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
