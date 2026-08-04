import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/social';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

export async function GET() {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const [{ data, error }, { data: systemData, error: systemError }] = await Promise.all([
      supabase.from('saved_cards').select('card_id, saved_at, aesthetic_cards(*)').eq('user_id', user.id).order('saved_at', { ascending: false }),
      supabase.from('system_saved_cards').select('system_card_key, saved_at').eq('user_id', user.id).order('saved_at', { ascending: false }),
    ]);
    if (error || systemError) return out(requestId, 500, { code: 'SAVED_QUERY_FAILED', message: 'Unable to load saved cards' });
    return out(requestId, 200, [...(data || []), ...(systemData || []).map((item) => ({ card_id: item.system_card_key, saved_at: item.saved_at, aesthetic_cards: null }))].sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at))));
  } catch { return out(requestId, 401, { code: 'UNAUTHENTICATED', message: 'Sign in required' }); }
}

export async function POST(request: Request) {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json() as { cardId?: string };
    if (!body.cardId) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'cardId is required' });
    let error = null;
    if (isUuid(body.cardId)) {
      ({ error } = await supabase.from('saved_cards').insert({ user_id: user.id, card_id: body.cardId }));
    } else {
      const admin = await createSupabaseAdminClient();
      const { data: registered } = await admin.from('system_cards').select('card_key').eq('card_key', body.cardId).maybeSingle();
      if (!registered) return out(requestId, 404, { code: 'CARD_NOT_FOUND', message: 'Card not found' });
      ({ error } = await supabase.from('system_saved_cards').insert({ user_id: user.id, system_card_key: body.cardId }));
    }
    if (error && error.code !== '23505') return out(requestId, 500, { code: 'SAVED_CREATE_FAILED', message: 'Unable to save card' });
    return out(requestId, 201, { saved: true, cardId: body.cardId });
  } catch (error) { return out(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'SAVED_CREATE_FAILED', message: 'Unable to save card' }); }
}

export async function DELETE(request: Request) {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const url = new URL(request.url);
    const cardId = url.searchParams.get('cardId');
    if (url.searchParams.get('all') === 'true') {
      const [{ error }, { error: systemError }] = await Promise.all([
        supabase.from('saved_cards').delete().eq('user_id', user.id),
        supabase.from('system_saved_cards').delete().eq('user_id', user.id),
      ]);
      if (error || systemError) return out(requestId, 500, { code: 'SAVED_DELETE_FAILED', message: 'Unable to clear saved cards' });
      return out(requestId, 200, { saved: false, all: true });
    }
    if (!cardId) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'cardId is required' });
    const { error } = isUuid(cardId)
      ? await supabase.from('saved_cards').delete().eq('user_id', user.id).eq('card_id', cardId)
      : await supabase.from('system_saved_cards').delete().eq('user_id', user.id).eq('system_card_key', cardId);
    if (error) return out(requestId, 500, { code: 'SAVED_DELETE_FAILED', message: 'Unable to unsave card' });
    return out(requestId, 200, { saved: false, cardId });
  } catch { return out(requestId, 401, { code: 'UNAUTHENTICATED', message: 'Sign in required' }); }
}
