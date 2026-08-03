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
      const code = message.includes('OWN_CARD') ? 'OWN_CARD_LIKE_FORBIDDEN' : message.includes('NOT_PUBLIC') ? 'CARD_NOT_PUBLIC' : message.includes('NOT_FOUND') ? 'CARD_NOT_FOUND' : 'LIKE_UPDATE_FAILED';
      const status = code === 'OWN_CARD_LIKE_FORBIDDEN' ? 403 : code === 'CARD_NOT_PUBLIC' || code === 'CARD_NOT_FOUND' ? 404 : 500;
      return out(requestId, status, { code, message: code === 'OWN_CARD_LIKE_FORBIDDEN' ? 'You cannot like your own card' : code === 'CARD_NOT_PUBLIC' ? 'Only published public cards can be liked' : 'Unable to update Like' });
    }
    return out(requestId, 200, data);
  } catch (error) {
    return out(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'LIKE_UPDATE_FAILED', message: 'Unable to update Like' });
  }
}

export async function POST(_request: Request, context: { params: Promise<{ cardId: string }> }) {
  return toggle(decodeURIComponent((await context.params).cardId), true);
}

export async function DELETE(_request: Request, context: { params: Promise<{ cardId: string }> }) {
  return toggle(decodeURIComponent((await context.params).cardId), false);
}
