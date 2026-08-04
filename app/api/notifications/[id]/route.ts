import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = `req_${crypto.randomUUID()}`;
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', (await context.params).id).eq('recipient_id', user.id).select('id, read_at').maybeSingle();
    if (error || !data) return NextResponse.json({ requestId, error: { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found' } }, { status: 404 });
    return NextResponse.json({ requestId, data: { id: data.id, read: true } });
  } catch {
    return NextResponse.json({ requestId, error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 });
  }
}
