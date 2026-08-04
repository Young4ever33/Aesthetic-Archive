import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

async function toggle(cardId: string, shouldLike: boolean) {
  const requestId = rid();
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc('toggle_card_like', { target_key: cardId, should_like: shouldLike });
    if (error) {
      const message = error.message || '';
      const code = message.includes('OWN_CARD') ? 'OWN_CARD_LIKE_FORBIDDEN' : message.includes('NOT_PUBLIC') ? 'CARD_NOT_PUBLIC' : message.includes('NOT_FOUND') ? 'CARD_NOT_FOUND' : message.includes('UNAUTHENTICATED') ? 'UNAUTHENTICATED' : 'LIKE_UPDATE_FAILED';
      const status = code === 'UNAUTHENTICATED' ? 401 : code === 'OWN_CARD_LIKE_FORBIDDEN' ? 403 : code === 'CARD_NOT_PUBLIC' || code === 'CARD_NOT_FOUND' ? 404 : 500;
      console.error('LIKE_RPC_FAILED', { requestId, cardId, databaseCode: error.code, message });
      const publicMessage = code === 'UNAUTHENTICATED' ? 'Sign in required' : code === 'OWN_CARD_LIKE_FORBIDDEN' ? 'You cannot like your own card' : code === 'CARD_NOT_PUBLIC' ? 'Only published public cards can be liked' : code === 'CARD_NOT_FOUND' ? 'Card not found' : `Unable to update Like (${error.code || 'database error'})`;
      return out(requestId, status, { code, message: publicMessage });
    }
    return out(requestId, 200, data);
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === 'UNAUTHENTICATED';
    console.error('LIKE_ROUTE_FAILED', { requestId, cardId, message: error instanceof Error ? error.message : 'Unknown error' });
    return out(requestId, unauthenticated ? 401 : 500, { code: unauthenticated ? 'UNAUTHENTICATED' : 'LIKE_UPDATE_FAILED', message: unauthenticated ? 'Sign in required' : 'Unable to update Like' });
  }
}

export async function POST(_request: Request, context: { params: Promise<{ cardId: string }> }) {
  return toggle(decodeURIComponent((await context.params).cardId), true);
}

export async function DELETE(_request: Request, context: { params: Promise<{ cardId: string }> }) {
  return toggle(decodeURIComponent((await context.params).cardId), false);
}
