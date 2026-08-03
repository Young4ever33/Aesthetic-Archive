import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { validateBoardSummaryRequest, ContractValidationError } from '@/lib/validation';
import { callTextProvider, gatewayError, getOwnedProvider, providerMeta, resolveModel } from '@/lib/ai-gateway';
import { logAiUsage } from '@/lib/ai-usage';

export const runtime = 'nodejs';

function failure(requestId: string, error: unknown) {
  const known = error as { code?: string; message?: string; retryable?: boolean; status?: number };
  const status = known.status || (error instanceof ContractValidationError ? 400 : 500);
  return NextResponse.json({ requestId, error: { code: known.code || (error instanceof ContractValidationError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR'), message: known.message || 'Unable to summarize board', retryable: known.retryable || false } }, { status });
}

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  const startedAt = Date.now();
  let userId = '';
  let providerId: string | null = null;
  let model: string | null = null;
  try {
    const { supabase, user } = await requireUser();
    userId = user.id;
    const body = validateBoardSummaryRequest(await request.json());
    const { data: cards, error } = await supabase.from('aesthetic_cards').select('id, title, title_zh, summary, design_elements, palette, composition, use_cases').in('id', body.cardIds).eq('owner_id', user.id);
    if (error) throw gatewayError('INTERNAL_ERROR', 'Unable to load board cards', 500);
    if (!cards || cards.length !== body.cardIds.length) throw gatewayError('FORBIDDEN', 'One or more cards are not owned by this user', 403);
    const provider = await getOwnedProvider(body.providerId, user.id);
    providerId = provider.id;
    model = resolveModel(provider, body.model, 'text');
    const text = await callTextProvider(provider, model, `Summarize the design logic of this private reference board. Return concise Markdown with: core direction, recurring visual grammar, palette/material logic, composition rules, and practical next steps. Do not invent historical provenance. Board title: ${body.boardTitle || 'Untitled Board'}. Context: ${body.boardContext || 'not provided'}. Cards: ${JSON.stringify(cards).slice(0, 40_000)}`);
    await logAiUsage(supabase, { ownerId: user.id, providerId: provider.id, route: '/api/ai/board-summary', model, status: 'success', requestId, durationMs: Date.now() - startedAt });
    return NextResponse.json({ requestId, data: { summary: text }, meta: providerMeta(provider, model) });
  } catch (error) {
    if (userId) {
      const { supabase } = await requireUser().catch(() => ({ supabase: null as never }));
      if (supabase) await logAiUsage(supabase, { ownerId: userId, providerId, route: '/api/ai/board-summary', model, status: 'error', requestId, error: error instanceof Error ? error.message : 'unknown', durationMs: Date.now() - startedAt });
    }
    return failure(requestId, error);
  }
}
