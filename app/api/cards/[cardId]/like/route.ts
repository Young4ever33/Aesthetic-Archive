import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

function normalizeLikeTarget(value: string) {
  const trimmed = value.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) return trimmed;
  const seedKey = trimmed.match(/^([A-Z]-[0-9]{2})(?:$|[-_])/i)?.[1];
  return seedKey ? seedKey.toUpperCase() : trimmed;
}

async function resolveLikeTarget(cardId: string) {
  const normalized = normalizeLikeTarget(cardId);
  if (/^[A-Z]-[0-9]{2}$/.test(normalized) || /^[0-9a-f-]{36}$/i.test(normalized)) return normalized;
  const admin = await createSupabaseAdminClient();
  const { data } = await admin.from('system_cards').select('card_key, title, title_zh');
  const requested = cardId.trim().toLowerCase();
  const match = (data || []).find(card => [card.card_key, card.title, card.title_zh].some(value => String(value || '').trim().toLowerCase() === requested));
  return match?.card_key || normalized;
}

async function toggle(cardId: string, shouldLike: boolean) {
  const requestId = rid();
  let targetKey = normalizeLikeTarget(cardId);
  try {
    const { supabase } = await requireUser();
    targetKey = await resolveLikeTarget(cardId);
    const { data, error } = await supabase.rpc('toggle_card_like', { target_key: targetKey, should_like: shouldLike });
    if (error) {
      const message = error.message || '';
      const code = message.includes('OWN_CARD') ? 'OWN_CARD_LIKE_FORBIDDEN' : message.includes('NOT_PUBLIC') ? 'CARD_NOT_PUBLIC' : message.includes('NOT_FOUND') ? 'CARD_NOT_FOUND' : message.includes('UNAUTHENTICATED') ? 'UNAUTHENTICATED' : 'LIKE_UPDATE_FAILED';
      const status = code === 'UNAUTHENTICATED' ? 401 : code === 'OWN_CARD_LIKE_FORBIDDEN' ? 403 : code === 'CARD_NOT_PUBLIC' || code === 'CARD_NOT_FOUND' ? 404 : 500;
      console.error('LIKE_RPC_FAILED', { requestId, cardId, targetKey, databaseCode: error.code, message });
      const publicMessage = code === 'UNAUTHENTICATED' ? 'Sign in required' : code === 'OWN_CARD_LIKE_FORBIDDEN' ? 'You cannot like your own card' : code === 'CARD_NOT_PUBLIC' ? 'Only published public cards can be liked' : code === 'CARD_NOT_FOUND' ? 'Card not found' : `Unable to update Like (${error.code || 'database error'})`;
      return out(requestId, status, { code, message: publicMessage, receivedTarget: cardId, normalizedTarget: targetKey, databaseCode: error.code || null });
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
