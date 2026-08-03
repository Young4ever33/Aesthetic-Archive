import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export async function PATCH() {
  const requestId = `req_${crypto.randomUUID()}`;
  try {
    const { user } = await requireUser();
    const { error } = await createSupabaseAdminClient().from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', user.id).is('read_at', null);
    if (error) return NextResponse.json({ requestId, error: { code: 'NOTIFICATIONS_UPDATE_FAILED', message: 'Unable to mark notifications read' } }, { status: 500 });
    return NextResponse.json({ requestId, data: { read: true } });
  } catch {
    return NextResponse.json({ requestId, error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 });
  }
}
