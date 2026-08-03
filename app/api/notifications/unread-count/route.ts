import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export async function GET() {
  const requestId = `req_${crypto.randomUUID()}`;
  try {
    const { user } = await requireUser();
    const { count, error } = await createSupabaseAdminClient().from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).is('read_at', null);
    if (error) return NextResponse.json({ requestId, error: { code: 'UNREAD_COUNT_FAILED', message: 'Unable to load unread count' } }, { status: 500 });
    return NextResponse.json({ requestId, data: { count: count || 0 } });
  } catch {
    return NextResponse.json({ requestId, error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 });
  }
}
