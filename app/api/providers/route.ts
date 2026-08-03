import { NextResponse } from 'next/server';
import { encryptProviderSecret } from '@/lib/provider-vault';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type ProviderPatch = {
  name?: string;
  type?: string;
  secret?: string;
  baseUrl?: string | null;
  imageCapable?: boolean;
  imageModels?: unknown[];
  generationModels?: unknown[];
  textModels?: unknown[];
  defaultImageModel?: string | null;
  defaultGenerationModel?: string | null;
  defaultTextModel?: string | null;
  imageApi?: string;
  imageApiUrl?: string | null;
  isDefault?: boolean;
};

function requestId() { return `req_${crypto.randomUUID()}`; }
function errorResponse(id: string, status: number, code: string, message: string) {
  return NextResponse.json({ requestId: id, error: { code, message } }, { status });
}
const publicColumns = 'id, name, type, base_url, image_capable, image_models, generation_models, text_models, default_image_model, default_generation_model, default_text_model, image_api, image_api_url, is_default, created_at, updated_at';

function messageFor(error: unknown, fallback: string) {
  if (error instanceof Error && /PROVIDER_ENCRYPTION_KEY/.test(error.message)) return 'Provider encryption is not configured correctly';
  return fallback;
}

function cleanModels(value: unknown[] | undefined) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))].slice(0, 50)
    : undefined;
}

function providerFields(body: ProviderPatch) {
  const imageModels = cleanModels(body.imageModels);
  const generationModels = cleanModels(body.generationModels);
  const textModels = cleanModels(body.textModels);
  return {
    ...(typeof body.name === 'string' ? { name: body.name.trim().slice(0, 120) } : {}),
    ...(typeof body.type === 'string' ? { type: body.type.trim().slice(0, 80) } : {}),
    ...(typeof body.baseUrl === 'string' || body.baseUrl === null ? { base_url: body.baseUrl?.trim().slice(0, 2000) || null } : {}),
    ...(typeof body.imageCapable === 'boolean' ? { image_capable: body.imageCapable } : {}),
    ...(imageModels ? { image_models: imageModels } : {}),
    ...(generationModels ? { generation_models: generationModels } : {}),
    ...(textModels ? { text_models: textModels } : {}),
    ...(typeof body.defaultImageModel === 'string' || body.defaultImageModel === null ? { default_image_model: body.defaultImageModel?.trim().slice(0, 200) || null } : {}),
    ...(typeof body.defaultGenerationModel === 'string' || body.defaultGenerationModel === null ? { default_generation_model: body.defaultGenerationModel?.trim().slice(0, 200) || null } : {}),
    ...(typeof body.defaultTextModel === 'string' || body.defaultTextModel === null ? { default_text_model: body.defaultTextModel?.trim().slice(0, 200) || null } : {}),
    ...(typeof body.imageApi === 'string' ? { image_api: body.imageApi.trim().slice(0, 80) } : {}),
    ...(typeof body.imageApiUrl === 'string' || body.imageApiUrl === null ? { image_api_url: body.imageApiUrl?.trim().slice(0, 2000) || null } : {}),
    ...(typeof body.isDefault === 'boolean' ? { is_default: body.isDefault } : {}),
  };
}

async function clearOtherDefaults(ownerId: string, providerId?: string) {
  const admin = createSupabaseAdminClient();
  let query = admin.from('ai_providers').update({ is_default: false }).eq('owner_id', ownerId);
  if (providerId) query = query.neq('id', providerId);
  const { error } = await query;
  if (error) throw new Error('Unable to update the default Provider');
}

export async function GET() {
  const id = requestId();
  try {
    const { user } = await requireUser();
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('ai_providers').select(publicColumns).eq('owner_id', user.id).order('created_at', { ascending: false });
    if (error) return errorResponse(id, 500, 'PROVIDER_QUERY_FAILED', 'Unable to load Provider settings');
    return NextResponse.json({ requestId: id, data: (data || []).map((provider) => ({ ...provider, hasSecret: true })) });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return errorResponse(id, 401, 'UNAUTHENTICATED', 'Sign in required');
    return errorResponse(id, 500, 'INTERNAL_ERROR', 'Unable to load Provider settings');
  }
}

export async function POST(request: Request) {
  const id = requestId();
  try {
    const { user } = await requireUser();
    const admin = createSupabaseAdminClient();
    const body = await request.json() as ProviderPatch;
    const secret = typeof body.secret === 'string' ? body.secret.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type = typeof body.type === 'string' ? body.type.trim() : '';
    const imageModels = cleanModels(body.imageModels) || [];
    const generationModels = cleanModels(body.generationModels) || [];
    const textModels = cleanModels(body.textModels) || [];
    if (!name || !type || !secret) return errorResponse(id, 400, 'INVALID_REQUEST', 'Provider name, type, and API key are required');
    if (secret.length > 4096) return errorResponse(id, 413, 'INVALID_REQUEST', 'Provider API key is too long');
    if (body.imageCapable !== false && imageModels.length === 0) return errorResponse(id, 400, 'INVALID_REQUEST', 'Add at least one vision model');
    if (imageModels.length === 0 && generationModels.length === 0 && textModels.length === 0) return errorResponse(id, 400, 'INVALID_REQUEST', 'Add at least one model');
    if (type.toLowerCase() === 'custom endpoint' && !body.baseUrl?.trim()) return errorResponse(id, 400, 'INVALID_REQUEST', 'Custom Endpoint requires a Base URL');
    if (body.isDefault) await clearOtherDefaults(user.id);
    const { data, error } = await admin.from('ai_providers').insert({
      owner_id: user.id,
      ...providerFields({ ...body, imageModels, generationModels, textModels }),
      name,
      type,
      encrypted_api_key: encryptProviderSecret(secret),
    }).select(publicColumns).single();
    if (error) return errorResponse(id, 500, 'PROVIDER_SAVE_FAILED', 'Unable to save Provider settings');
    return NextResponse.json({ requestId: id, data: { ...data, hasSecret: true } }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse(id, 400, 'INVALID_REQUEST', 'Invalid JSON body');
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return errorResponse(id, 401, 'UNAUTHENTICATED', 'Sign in required');
    return errorResponse(id, 500, 'PROVIDER_SAVE_FAILED', messageFor(error, 'Unable to save Provider settings'));
  }
}

export async function PATCH(request: Request) {
  const id = requestId();
  try {
    const { user } = await requireUser();
    const admin = createSupabaseAdminClient();
    const providerId = new URL(request.url).searchParams.get('id');
    if (!providerId) return errorResponse(id, 400, 'INVALID_REQUEST', 'Provider id is required');
    const body = await request.json() as ProviderPatch;
    const updates: Record<string, unknown> = providerFields(body);
    if (typeof body.secret === 'string' && body.secret.trim()) {
      if (body.secret.length > 4096) return errorResponse(id, 413, 'INVALID_REQUEST', 'Provider API key is too long');
      updates.encrypted_api_key = encryptProviderSecret(body.secret.trim());
    }
    if (!Object.keys(updates).length) return errorResponse(id, 400, 'INVALID_REQUEST', 'No Provider changes supplied');
    if (body.isDefault) await clearOtherDefaults(user.id, providerId);
    const { data, error } = await admin.from('ai_providers').update(updates).eq('id', providerId).eq('owner_id', user.id).select(publicColumns).maybeSingle();
    if (error) return errorResponse(id, 500, 'PROVIDER_UPDATE_FAILED', 'Unable to update Provider settings');
    if (!data) return errorResponse(id, 404, 'PROVIDER_NOT_FOUND', 'Provider was not found');
    return NextResponse.json({ requestId: id, data: { ...data, hasSecret: true } });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse(id, 400, 'INVALID_REQUEST', 'Invalid JSON body');
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return errorResponse(id, 401, 'UNAUTHENTICATED', 'Sign in required');
    return errorResponse(id, 500, 'PROVIDER_UPDATE_FAILED', messageFor(error, 'Unable to update Provider settings'));
  }
}

export async function DELETE(request: Request) {
  const id = requestId();
  try {
    const { user } = await requireUser();
    const admin = createSupabaseAdminClient();
    const providerId = new URL(request.url).searchParams.get('id');
    if (!providerId) return errorResponse(id, 400, 'INVALID_REQUEST', 'Provider id is required');
    const { error } = await admin.from('ai_providers').delete().eq('id', providerId).eq('owner_id', user.id);
    if (error) return errorResponse(id, 500, 'PROVIDER_DELETE_FAILED', 'Unable to delete Provider settings');
    return NextResponse.json({ requestId: id, data: { deleted: true } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return errorResponse(id, 401, 'UNAUTHENTICATED', 'Sign in required');
    return errorResponse(id, 500, 'INTERNAL_ERROR', 'Unable to delete Provider settings');
  }
}
