import { NextResponse } from 'next/server';
import { encryptProviderSecret } from '@/lib/provider-vault';
import { requireUser } from '@/lib/supabase/server';
import { normalizeProviderType } from '@/lib/ai-gateway';

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
  if (error instanceof Error && /PROVIDER_ENCRYPTION_KEY/.test(error.message)) return 'Provider encryption is not configured correctly in the Worker';
  if (error instanceof Error && /Supabase admin environment/.test(error.message)) return 'Supabase service configuration is missing from the Worker';
  return fallback;
}

function databaseMessage(error: { code?: string; message?: string } | null, fallback: string) {
  if (!error) return fallback;
  if (error.code === '42703' || /column .* does not exist/i.test(error.message || '')) return 'Provider database migration is incomplete. Apply migrations through 202608030010';
  if (error.code === '42501') return 'Provider database permissions are not configured correctly';
  return fallback;
}

function safeBaseUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    const privateHost = host === 'localhost' || host === '0.0.0.0' || host === '::1' || host.endsWith('.local') || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || !host.includes('.');
    if (url.protocol !== 'https:' || privateHost || url.username || url.password) return null;
    return url.toString().replace(/\/$/, '').slice(0, 2000);
  } catch { return null; }
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
    ...(typeof body.type === 'string' ? { type: canonicalProviderType(body.type) } : {}),
    ...(typeof body.baseUrl === 'string' || body.baseUrl === null ? { base_url: body.baseUrl ? safeBaseUrl(body.baseUrl) : null } : {}),
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

function canonicalProviderType(value: string) {
  const normalized = normalizeProviderType(value);
  if (normalized === 'openai') return 'OpenAI';
  if (normalized === 'gemini') return 'Gemini';
  if (normalized === 'openrouter') return 'OpenRouter';
  if (normalized === 'custom endpoint') return 'Custom Endpoint';
  return value.trim().slice(0, 80);
}

function validateDefaults(body: ProviderPatch, imageModels: string[], generationModels: string[], textModels: string[]) {
  const defaults: Array<[unknown, string[], string]> = [
    [body.defaultImageModel, imageModels, 'vision'],
    [body.defaultGenerationModel, generationModels, 'generation'],
    [body.defaultTextModel, textModels, 'text'],
  ];
  for (const [value, allowed, label] of defaults) {
    if (typeof value === 'string' && value.trim() && !allowed.includes(value.trim())) return `Default ${label} model must appear in its model list`;
  }
  return '';
}

async function clearOtherDefaults(supabase: Awaited<ReturnType<typeof requireUser>>['supabase'], ownerId: string, providerId?: string) {
  let query = supabase.from('ai_providers').update({ is_default: false }).eq('owner_id', ownerId);
  if (providerId) query = query.neq('id', providerId);
  const { error } = await query;
  if (error) throw new Error('Unable to update the default Provider');
}

export async function GET() {
  const id = requestId();
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from('ai_providers').select(publicColumns).eq('owner_id', user.id).order('created_at', { ascending: false });
    if (error) {
      console.error('PROVIDER_QUERY_FAILED', { requestId: id, code: error.code, message: error.message });
      return errorResponse(id, 500, 'PROVIDER_QUERY_FAILED', databaseMessage(error, 'Unable to load Provider settings'));
    }
    return NextResponse.json({ requestId: id, data: (data || []).map((provider) => ({ ...provider, hasSecret: true })) });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return errorResponse(id, 401, 'UNAUTHENTICATED', 'Sign in required');
    console.error('PROVIDER_QUERY_INTERNAL_ERROR', { requestId: id, message: error instanceof Error ? error.message : 'unknown' });
    return errorResponse(id, 500, 'INTERNAL_ERROR', messageFor(error, 'Unable to load Provider settings'));
  }
}

export async function POST(request: Request) {
  const id = requestId();
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json() as ProviderPatch;
    const secret = typeof body.secret === 'string' ? body.secret.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type = typeof body.type === 'string' ? canonicalProviderType(body.type) : '';
    const imageModels = cleanModels(body.imageModels) || [];
    const generationModels = cleanModels(body.generationModels) || [];
    const textModels = cleanModels(body.textModels) || [];
    if (!name || !type || !secret) return errorResponse(id, 400, 'INVALID_REQUEST', 'Provider name, type, and API key are required');
    if (secret.length > 4096) return errorResponse(id, 413, 'INVALID_REQUEST', 'Provider API key is too long');
    if (body.imageCapable !== false && imageModels.length === 0) return errorResponse(id, 400, 'INVALID_REQUEST', 'Add at least one vision model');
    if (imageModels.length === 0 && generationModels.length === 0 && textModels.length === 0) return errorResponse(id, 400, 'INVALID_REQUEST', 'Add at least one model');
    if (body.baseUrl && !safeBaseUrl(body.baseUrl)) return errorResponse(id, 400, 'INVALID_REQUEST', 'Base URL must be a public HTTPS endpoint');
    if (normalizeProviderType(type) === 'custom endpoint' && !safeBaseUrl(body.baseUrl)) return errorResponse(id, 400, 'INVALID_REQUEST', 'Custom Endpoint requires a public HTTPS Base URL');
    const defaultError = validateDefaults(body, imageModels, generationModels, textModels);
    if (defaultError) return errorResponse(id, 400, 'INVALID_REQUEST', defaultError);
    if (body.isDefault) await clearOtherDefaults(supabase, user.id);
    const { data, error } = await supabase.from('ai_providers').insert({
      owner_id: user.id,
      ...providerFields({ ...body, imageModels, generationModels, textModels }),
      name,
      type,
      encrypted_api_key: encryptProviderSecret(secret),
    }).select(publicColumns).single();
    if (error) return errorResponse(id, 500, 'PROVIDER_SAVE_FAILED', databaseMessage(error, 'Unable to save Provider settings'));
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
    const { supabase, user } = await requireUser();
    const providerId = new URL(request.url).searchParams.get('id');
    if (!providerId) return errorResponse(id, 400, 'INVALID_REQUEST', 'Provider id is required');
    const body = await request.json() as ProviderPatch;
    if (body.baseUrl && !safeBaseUrl(body.baseUrl)) return errorResponse(id, 400, 'INVALID_REQUEST', 'Base URL must be a public HTTPS endpoint');
    if (typeof body.type === 'string' && normalizeProviderType(body.type) === 'custom endpoint' && !safeBaseUrl(body.baseUrl)) return errorResponse(id, 400, 'INVALID_REQUEST', 'Custom Endpoint requires a public HTTPS Base URL');
    const imageModels = cleanModels(body.imageModels);
    const generationModels = cleanModels(body.generationModels);
    const textModels = cleanModels(body.textModels);
    if (imageModels && generationModels && textModels) {
      const defaultError = validateDefaults(body, imageModels, generationModels, textModels);
      if (defaultError) return errorResponse(id, 400, 'INVALID_REQUEST', defaultError);
    }
    const updates: Record<string, unknown> = providerFields(body);
    if (typeof body.secret === 'string' && body.secret.trim()) {
      if (body.secret.length > 4096) return errorResponse(id, 413, 'INVALID_REQUEST', 'Provider API key is too long');
      updates.encrypted_api_key = encryptProviderSecret(body.secret.trim());
    }
    if (!Object.keys(updates).length) return errorResponse(id, 400, 'INVALID_REQUEST', 'No Provider changes supplied');
    if (body.isDefault) await clearOtherDefaults(supabase, user.id, providerId);
    const { data, error } = await supabase.from('ai_providers').update(updates).eq('id', providerId).eq('owner_id', user.id).select(publicColumns).maybeSingle();
    if (error) return errorResponse(id, 500, 'PROVIDER_UPDATE_FAILED', databaseMessage(error, 'Unable to update Provider settings'));
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
