import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { isUuid } from '@/lib/social';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  try {
    const { supabase } = await requireUser();
    const keys = [...new Set((new URL(request.url).searchParams.get('keys') || '')
      .split(',')
      .map((key) => key.trim())
      .filter((key) => isUuid(key) || /^[A-Z]-[0-9]{2}$/.test(key)))]
      .slice(0, 100);
    if (!keys.length) return NextResponse.json({ requestId, data: {} });

    const { data, error } = await supabase.rpc('get_card_interactions', { target_keys: keys });
    if (error) {
      console.error('INTERACTIONS_QUERY_FAILED', { requestId, code: error.code, message: error.message });
      return NextResponse.json({ requestId, error: { code: 'INTERACTIONS_QUERY_FAILED', message: 'Unable to load card interactions' } }, { status: 500 });
    }
    return NextResponse.json({ requestId, data: data || {} });
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === 'UNAUTHENTICATED';
    return NextResponse.json({ requestId, error: { code: unauthenticated ? 'UNAUTHENTICATED' : 'INTERACTIONS_QUERY_FAILED', message: unauthenticated ? 'Sign in required' : 'Unable to load card interactions' } }, { status: unauthenticated ? 401 : 500 });
  }
}
