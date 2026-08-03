import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

async function toggle(publicId: string, shouldFollow: boolean) {
  const requestId = rid();
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc('toggle_author_follow', { target_public_id: publicId, should_follow: shouldFollow });
    if (error) {
      const message = error.message || '';
      const code = message.includes('SELF_FOLLOW') ? 'SELF_FOLLOW_FORBIDDEN' : message.includes('AUTHOR_NOT_FOUND') ? 'AUTHOR_NOT_FOUND' : 'FOLLOW_UPDATE_FAILED';
      return out(requestId, code === 'SELF_FOLLOW_FORBIDDEN' ? 403 : code === 'AUTHOR_NOT_FOUND' ? 404 : 500, { code, message: code === 'SELF_FOLLOW_FORBIDDEN' ? 'You cannot follow yourself' : 'Unable to update Follow' });
    }
    return out(requestId, 200, data);
  } catch (error) {
    return out(requestId, error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500, { code: 'FOLLOW_UPDATE_FAILED', message: 'Unable to update Follow' });
  }
}

export async function POST(_request: Request, context: { params: Promise<{ publicId: string }> }) { return toggle((await context.params).publicId, true); }
export async function DELETE(_request: Request, context: { params: Promise<{ publicId: string }> }) { return toggle((await context.params).publicId, false); }
