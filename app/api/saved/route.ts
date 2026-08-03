import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

export async function GET() {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from('saved_cards').select('card_id, saved_at, aesthetic_cards(*)').eq('user_id', user.id).order('saved_at', { ascending: false });
    if (error) return out(requestId, 500, { code: 'SAVED_QUERY_FAILED', message: 'Unable to load saved cards' });
    return out(requestId, 200, data || []);
  } catch { return out(requestId, 401, { code: 'UNAUTHENTICATED', message: 'Sign in required' }); }
}

export async function POST(request: Request) {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json() as { cardId?: string };
    if (!body.cardId) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'cardId is required' });
    const { error } = await supabase.from('saved_cards').insert({ user_id: user.id, card_id: body.cardId });
    if (error) return out(requestId, 500, { code: 'SAVED_CREATE_FAILED', message: 'Unable to save card' });
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
      const { error } = await supabase.from('saved_cards').delete().eq('user_id', user.id);
      if (error) return out(requestId, 500, { code: 'SAVED_DELETE_FAILED', message: 'Unable to clear saved cards' });
      return out(requestId, 200, { saved: false, all: true });
    }
    if (!cardId) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'cardId is required' });
    const { error } = await supabase.from('saved_cards').delete().eq('user_id', user.id).eq('card_id', cardId);
    if (error) return out(requestId, 500, { code: 'SAVED_DELETE_FAILED', message: 'Unable to unsave card' });
    return out(requestId, 200, { saved: false, cardId });
  } catch { return out(requestId, 401, { code: 'UNAUTHENTICATED', message: 'Sign in required' }); }
}
