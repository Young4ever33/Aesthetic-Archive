import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireReviewRole } from '@/lib/review-access';

export const runtime = 'nodejs';
const id = () => `req_${crypto.randomUUID()}`;
const out = (requestId: string, status: number, value: unknown) => NextResponse.json({ requestId, ...(status >= 400 ? { error: value } : { data: value }) }, { status });

async function reviewer() {
  const { user } = await requireUser();
  await requireReviewRole(user.id);
  return user;
}

export async function GET() {
  const requestId = id();
  try {
    await reviewer();
    const admin = await createSupabaseAdminClient();
    const { data, error } = await admin.from('system_messages').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) return out(requestId, 500, { code: 'SYSTEM_MESSAGES_QUERY_FAILED', message: 'Unable to load system messages' });
    return out(requestId, 200, data || []);
  } catch (error) {
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401;
    return out(requestId, status, { code: status === 403 ? 'FORBIDDEN' : 'UNAUTHENTICATED', message: status === 403 ? 'Reviewer access required' : 'Sign in required' });
  }
}

export async function POST(request: Request) {
  const requestId = id();
  try {
    const user = await reviewer();
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const text = (key: string) => typeof body[key] === 'string' ? String(body[key]).trim().slice(0, 20_000) : '';
    const titleZh = text('titleZh'), titleEn = text('titleEn'), bodyZh = text('bodyZh'), bodyEn = text('bodyEn');
    if (!titleZh || !titleEn || !bodyZh || !bodyEn) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'Both Chinese and English title and body are required' });
    const admin = await createSupabaseAdminClient();
    const { data: message, error } = await admin.from('system_messages').insert({ title_zh: titleZh, title_en: titleEn, body_zh: bodyZh, body_en: bodyEn, created_by: user.id }).select('*').single();
    if (error || !message) return out(requestId, 500, { code: 'SYSTEM_MESSAGE_CREATE_FAILED', message: 'Unable to save system message' });
    if (body.publish === true) {
      const { error: publishError } = await admin.rpc('publish_system_message', { message_id: message.id });
      if (publishError) return out(requestId, 500, { code: 'SYSTEM_MESSAGE_PUBLISH_FAILED', message: 'Message saved but could not be published' });
    }
    return out(requestId, 201, message);
  } catch (error) {
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401;
    return out(requestId, status, { code: status === 403 ? 'FORBIDDEN' : 'UNAUTHENTICATED', message: status === 403 ? 'Reviewer access required' : 'Sign in required' });
  }
}

export async function PATCH(request: Request) {
  const requestId = id();
  try {
    await reviewer();
    const messageId = new URL(request.url).searchParams.get('id');
    if (!messageId) return out(requestId, 400, { code: 'INVALID_REQUEST', message: 'Message id is required' });
    const admin = await createSupabaseAdminClient();
    const { data: message, error } = await admin.from('system_messages').select('*').eq('id', messageId).single();
    if (error || !message) return out(requestId, 404, { code: 'SYSTEM_MESSAGE_NOT_FOUND', message: 'System message not found' });
    if (message.published) return out(requestId, 409, { code: 'SYSTEM_MESSAGE_ALREADY_PUBLISHED', message: 'Published messages cannot be edited' });
    const { error: updateError } = await admin.from('system_messages').update({ published: true, published_at: new Date().toISOString() }).eq('id', messageId);
    if (updateError) return out(requestId, 500, { code: 'SYSTEM_MESSAGE_PUBLISH_FAILED', message: 'Unable to publish system message' });
    const { error: rpcError } = await admin.rpc('publish_system_message', { message_id: messageId });
    if (rpcError) return out(requestId, 500, { code: 'SYSTEM_MESSAGE_NOTIFY_FAILED', message: 'Unable to deliver system message' });
    return out(requestId, 200, { id: messageId, published: true });
  } catch (error) {
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401;
    return out(requestId, status, { code: status === 403 ? 'FORBIDDEN' : 'UNAUTHENTICATED', message: status === 403 ? 'Reviewer access required' : 'Sign in required' });
  }
}
