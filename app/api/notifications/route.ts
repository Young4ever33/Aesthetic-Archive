import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { actorPublicProfiles } from '@/lib/social';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

export async function GET(request: Request) {
  const requestId = rid();
  try {
    const { user } = await requireUser();
    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const before = url.searchParams.get('before');
    const admin = createSupabaseAdminClient();
    let query = admin.from('notifications').select('id, actor_id, type, card_id, system_card_key, author_id, payload, read_at, created_at').eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(limit + 1);
    if (before) query = query.lt('created_at', before);
    const { data, error } = await query;
    if (error) return out(requestId, 500, { code: 'NOTIFICATIONS_QUERY_FAILED', message: 'Unable to load notifications' });
    const rows = data || [];
    const actors = await actorPublicProfiles(rows.map((item) => item.actor_id).filter((value): value is string => Boolean(value)));
    const items = rows.slice(0, limit).map((item) => ({
      id: item.id,
      type: item.type,
      cardId: item.card_id || item.system_card_key || null,
      authorId: item.author_id,
      payload: item.payload || {},
      read: Boolean(item.read_at),
      createdAt: item.created_at,
      actor: item.actor_id ? actors.get(item.actor_id) || { publicId: '', name: 'Aesthetic Archive Member', avatar: '' } : null,
    }));
    return out(requestId, 200, { items, nextCursor: rows.length > limit ? items.at(-1)?.createdAt || null : null });
  } catch (error) {
    return out(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'NOTIFICATIONS_QUERY_FAILED', message: 'Unable to load notifications' });
  }
}
