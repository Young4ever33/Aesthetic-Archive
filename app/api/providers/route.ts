import { NextResponse } from 'next/server';
import { encryptProviderSecret } from '@/lib/provider-vault';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type ProviderPatch = {
  name?: string;
  type?: string;
  secret?: string;
  baseUrl?: string | null;
  imageCapable?: boolean;
  imageModels?: unknown[];
  textModels?: unknown[];
  defaultImageModel?: string | null;
  defaultTextModel?: string | null;
  imageApi?: string;
  imageApiUrl?: string | null;
  isDefault?: boolean;
};

function requestId() { return `req_${crypto.randomUUID()}`; }
function errorResponse(id: string, status: number, code: string, message: string) { return NextResponse.json({ requestId: id, error: { code, message } }, { status }); }
const publicColumns = 'id, name, type, base_url, image_capable, image_models, text_models, default_image_model, default_text_model, image_api, image_api_url, is_default, created_at, updated_at';

export async function GET() {
  const id = requestId();
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from('ai_providers').select(publicColumns).order('created_at', { ascending: false });
    if (error) return errorResponse(id, 500, 'PROVIDER_QUERY_FAILED', 'Unable to load Provider settings');
    return NextResponse.json({ requestId: id, data: data.map((provider) => ({ ...provider, hasSecret: true })) });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return errorResponse(id, 401, 'UNAUTHENTICATED', 'Sign in required');
    return errorResponse(id, 500, 'INTERNAL_ERROR', 'Unable to load Provider settings');
  }
}

function providerFields(body: ProviderPatch) {
  return {
    ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
    ...(typeof body.type === 'string' ? { type: body.type.trim() } : {}),
    ...(typeof body.baseUrl === 'string' || body.baseUrl === null ? { base_url: body.baseUrl?.trim() || null } : {}),
    ...(typeof body.imageCapable === 'boolean' ? { image_capable: body.imageCapable } : {}),
    ...(Array.isArray(body.imageModels) ? { image_models: body.imageModels } : {}),
    ...(Array.isArray(body.textModels) ? { text_models: body.textModels } : {}),
    ...(typeof body.defaultImageModel === 'string' || body.defaultImageModel === null ? { default_image_model: body.defaultImageModel } : {}),
    ...(typeof body.defaultTextModel === 'string' || body.defaultTextModel === null ? { default_text_model: body.defaultTextModel } : {}),
    ...(typeof body.imageApi === 'string' ? { image_api: body.imageApi } : {}),
    ...(typeof body.imageApiUrl === 'string' || body.imageApiUrl === null ? { image_api_url: body.imageApiUrl } : {}),
    ...(typeof body.isDefault === 'boolean' ? { is_default: body.isDefault } : {}),
  };
}

export async function POST(request: Request) {
  const id = requestId();
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json() as ProviderPatch;
    const secret = typeof body.secret === 'string' ? body.secret : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type = typeof body.type === 'string' ? body.type.trim() : '';
    if (!name || !type || !secret.trim()) return errorResponse(id, 400, 'INVALID_REQUEST', 'name, type and secret are required');
    if (secret.length > 4096) return errorResponse(id, 413, 'INVALID_REQUEST', 'Provider secret is too long');
    const { data, error } = await supabase.from('ai_providers').insert({ owner_id: user.id, ...providerFields(body), name, type, encrypted_api_key: encryptProviderSecret(secret) }).select(publicColumns).single();
    if (error) return errorResponse(id, 500, 'PROVIDER_SAVE_FAILED', 'Unable to save Provider settings');
    return NextResponse.json({ requestId: id, data: { ...data, hasSecret: true } }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse(id, 400, 'INVALID_REQUEST', 'Invalid JSON body');
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return errorResponse(id, 401, 'UNAUTHENTICATED', 'Sign in required');
    return errorResponse(id, 500, 'INTERNAL_ERROR', 'Unable to save Provider settings');
  }
}

export async function PATCH(request: Request) {
  const id = requestId();
  try {
    const { supabase, user } = await requireUser();
    const providerId = new URL(request.url).searchParams.get('id');
    if (!providerId) return errorResponse(id, 400, 'INVALID_REQUEST', 'Provider id is required');
    const body = await request.json() as ProviderPatch;
    const updates: Record<string, unknown> = providerFields(body);
    if (typeof body.secret === 'string' && body.secret.trim()) {
      if (body.secret.length > 4096) return errorResponse(id, 413, 'INVALID_REQUEST', 'Provider secret is too long');
      updates.encrypted_api_key = encryptProviderSecret(body.secret);
    }
    if (!Object.keys(updates).length) return errorResponse(id, 400, 'INVALID_REQUEST', 'No Provider changes supplied');
    const { data, error } = await supabase.from('ai_providers').update(updates).eq('id', providerId).eq('owner_id', user.id).select(publicColumns).single();
    if (error) return errorResponse(id, 500, 'PROVIDER_UPDATE_FAILED', 'Unable to update Provider settings');
    return NextResponse.json({ requestId: id, data: { ...data, hasSecret: true } });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse(id, 400, 'INVALID_REQUEST', 'Invalid JSON body');
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return errorResponse(id, 401, 'UNAUTHENTICATED', 'Sign in required');
    return errorResponse(id, 500, 'INTERNAL_ERROR', 'Unable to update Provider settings');
  }
}

export async function DELETE(request: Request) {
  const id = requestId();
  try {
    const { supabase, user } = await requireUser();
    const providerId = new URL(request.url).searchParams.get('id');
    if (!providerId) return errorResponse(id, 400, 'INVALID_REQUEST', 'Provider id is required');
    const { error } = await supabase.from('ai_providers').delete().eq('id', providerId).eq('owner_id', user.id);
    if (error) return errorResponse(id, 500, 'PROVIDER_DELETE_FAILED', 'Unable to delete Provider settings');
    return NextResponse.json({ requestId: id, data: { deleted: true } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return errorResponse(id, 401, 'UNAUTHENTICATED', 'Sign in required');
    return errorResponse(id, 500, 'INTERNAL_ERROR', 'Unable to delete Provider settings');
  }
}
