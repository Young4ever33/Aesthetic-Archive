import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { isUuid } from '@/lib/social';

export const runtime = 'nodejs';
function rid() { return `req_${crypto.randomUUID()}`; }
function out(requestId: string, status: number, value: unknown) { return NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status }); }

export async function GET(_request: Request, context: { params: Promise<{ publicId: string }> }) {
  const requestId = rid();
  try {
    const { supabase } = await requireUser();
    const publicId = (await context.params).publicId;
    if (!isUuid(publicId)) return out(requestId, 404, { code: 'AUTHOR_NOT_FOUND', message: 'Author not found' });

    const { data, error } = await supabase.rpc('get_public_author_summary', { target_public_id: publicId });
    if (error) {
      console.error('AUTHOR_QUERY_FAILED', { requestId, code: error.code, message: error.message });
      return out(requestId, 500, { code: 'AUTHOR_QUERY_FAILED', message: 'Unable to load author' });
    }
    if (!data) return out(requestId, 404, { code: 'AUTHOR_NOT_FOUND', message: 'Author not found' });
    return out(requestId, 200, data);
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === 'UNAUTHENTICATED';
    return out(requestId, unauthenticated ? 401 : 500, { code: unauthenticated ? 'UNAUTHENTICATED' : 'AUTHOR_QUERY_FAILED', message: unauthenticated ? 'Sign in required' : 'Unable to load author' });
  }
}
