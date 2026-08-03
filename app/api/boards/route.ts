import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { ContractValidationError, MAX_JSON_BODY_BYTES, assertRequestBodySize } from '@/lib/validation';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }
function boardPayload(body: Record<string, unknown>) { return { title: typeof body.title === 'string' ? body.title.slice(0, 200) : 'Untitled Board', summary: typeof body.summary === 'string' ? body.summary.slice(0, 10000) : null, visibility: body.visibility === 'public' ? 'public' : 'private' }; }
function finite(value: unknown, fallback: number, min: number, max: number) { const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback; return Math.min(max, Math.max(min, number)); }
function boardParts(body: { nodes?: Record<string, unknown>[]; strokes?: Record<string, unknown>[] }) {
  const nodes = Array.isArray(body.nodes) ? body.nodes.slice(0, 200) : [];
  const strokes = Array.isArray(body.strokes) ? body.strokes.slice(0, 500) : [];
  return {
    nodes: nodes.map(node => ({ board_id: '', owner_id: '', ref_card_id: typeof node.ref_card_id === 'string' ? node.ref_card_id : null, type: typeof node.type === 'string' ? node.type.slice(0, 30) : 'image', data: node.data && typeof node.data === 'object' ? node.data : {}, x: finite(node.x, 0, -10000, 10000), y: finite(node.y, 0, -10000, 10000), w: finite(node.w, 120, 20, 2400), h: finite(node.h, 80, 20, 2400), rotation: finite(node.rotation, 0, -360, 360), z: finite(node.z, 1, 0, 100000) })),
    strokes: strokes.map(stroke => ({ board_id: '', owner_id: '', points: Array.isArray(stroke.points) ? stroke.points.slice(0, 5000) : [], color: typeof stroke.color === 'string' ? stroke.color.slice(0, 20) : '#111111', size: finite(stroke.size, 3, 1, 40), z: finite(stroke.z, 1, 0, 100000) }))
  };
}

export async function GET() {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const { data: boards, error } = await supabase.from('boards').select('*').eq('owner_id', user.id).order('updated_at', { ascending: false });
    if (error) return out(requestId, 500, { code: 'BOARD_QUERY_FAILED', message: 'Unable to load boards' });
    const result = await Promise.all((boards || []).map(async board => {
      const [{ data: nodes }, { data: strokes }] = await Promise.all([
        supabase.from('board_nodes').select('*').eq('board_id', board.id).eq('owner_id', user.id).order('z'),
        supabase.from('board_strokes').select('*').eq('board_id', board.id).eq('owner_id', user.id).order('z')
      ]);
      return { ...board, nodes: nodes || [], strokes: strokes || [] };
    }));
    return out(requestId, 200, result);
  } catch { return out(requestId, 401, { code: 'UNAUTHENTICATED', message: 'Sign in required' }); }
}

export async function POST(request: Request) {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    assertRequestBodySize(request, MAX_JSON_BODY_BYTES);
    const body = await request.json() as Record<string, unknown>;
    const { data: board, error } = await supabase.from('boards').insert({ owner_id: user.id, ...boardPayload(body) }).select('*').single();
    if (error) return out(requestId, 500, { code: 'BOARD_CREATE_FAILED', message: 'Unable to create board' });
    return out(requestId, 201, board);
  } catch { return out(requestId, 401, { code: 'UNAUTHENTICATED', message: 'Sign in required' }); }
}

export async function PATCH(request: Request) {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const boardId = new URL(request.url).searchParams.get('id');
    if (!boardId) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'Board id is required' });
    assertRequestBodySize(request, MAX_JSON_BODY_BYTES);
    const body = await request.json() as { board?: Record<string, unknown>; nodes?: Record<string, unknown>[]; strokes?: Record<string, unknown>[] };
    const { data: board, error } = await supabase.from('boards').update(boardPayload(body.board || {})).eq('id', boardId).eq('owner_id', user.id).select('*').single();
    if (error) return out(requestId, 404, { code: 'BOARD_NOT_FOUND', message: 'Board not found' });
    await supabase.from('board_nodes').delete().eq('board_id', boardId).eq('owner_id', user.id);
    await supabase.from('board_strokes').delete().eq('board_id', boardId).eq('owner_id', user.id);
    const parts = boardParts(body);
    const nodes = parts.nodes.map(node => ({ ...node, board_id: boardId, owner_id: user.id }));
    const strokes = parts.strokes.map(stroke => ({ ...stroke, board_id: boardId, owner_id: user.id }));
    if (nodes.length) await supabase.from('board_nodes').insert(nodes);
    if (strokes.length) await supabase.from('board_strokes').insert(strokes);
    return out(requestId, 200, board);
  } catch (error) { return out(requestId, error instanceof ContractValidationError ? 413 : 500, { code: error instanceof ContractValidationError ? 'REQUEST_TOO_LARGE' : 'BOARD_UPDATE_FAILED', message: error instanceof ContractValidationError ? error.message : 'Unable to update board' }); }
}

export async function DELETE(request: Request) {
  const requestId = rid();
  try {
    const { supabase, user } = await requireUser();
    const boardId = new URL(request.url).searchParams.get('id');
    if (!boardId) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'Board id is required' });
    const { error } = await supabase.from('boards').delete().eq('id', boardId).eq('owner_id', user.id);
    if (error) return out(requestId, 500, { code: 'BOARD_DELETE_FAILED', message: 'Unable to delete board' });
    return out(requestId, 200, { deleted: true });
  } catch { return out(requestId, 401, { code: 'UNAUTHENTICATED', message: 'Sign in required' }); }
}
