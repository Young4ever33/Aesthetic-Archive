import { ProxyAgent, request } from 'undici';
import { decryptProviderSecret } from './provider-vault';
import { createSupabaseAdminClient } from './supabase/admin';
import type { AiErrorCode, AiResponseMeta } from './contracts';

export type ProviderRecord = {
  id: string;
  owner_id: string;
  name: string;
  type: string;
  encrypted_api_key: string;
  base_url: string | null;
  image_capable: boolean;
  image_models: unknown;
  text_models: unknown;
  default_image_model: string | null;
  default_text_model: string | null;
};

export type GatewayError = Error & {
  code: AiErrorCode;
  retryable: boolean;
  status: number;
};

export function gatewayError(code: AiErrorCode, message: string, status: number, retryable = false): GatewayError {
  const error = new Error(message) as GatewayError;
  error.code = code;
  error.retryable = retryable;
  error.status = status;
  return error;
}

export async function getOwnedProvider(providerId: string, userId: string): Promise<ProviderRecord> {
  if (!providerId) throw gatewayError('INVALID_REQUEST', 'Provider id is required', 400);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('ai_providers')
    .select('id, owner_id, name, type, encrypted_api_key, base_url, image_capable, image_models, text_models, default_image_model, default_text_model')
    .eq('id', providerId)
    .eq('owner_id', userId)
    .maybeSingle();

  if (error) throw gatewayError('INTERNAL_ERROR', 'Unable to load Provider', 500);
  if (!data) throw gatewayError('PROVIDER_NOT_FOUND', 'Provider was not found', 404);
  return data as ProviderRecord;
}

export function providerMeta(provider: ProviderRecord, model: string, templateId?: string, templateVersion?: number): AiResponseMeta {
  return {
    providerType: provider.type,
    model,
    ...(templateId ? { templateId } : {}),
    ...(templateVersion ? { templateVersion } : {}),
  };
}

function modelList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

export function resolveModel(provider: ProviderRecord, requested: unknown, kind: 'image' | 'text'): string {
  const requestedModel = typeof requested === 'string' ? requested.trim() : '';
  const allowed = modelList(kind === 'image' ? provider.image_models : provider.text_models);
  const fallback = kind === 'image' ? provider.default_image_model : provider.default_text_model;
  const model = requestedModel || fallback || allowed[0] || '';
  if (!model) throw gatewayError('INVALID_REQUEST', `No ${kind} model is configured`, 400);
  if (allowed.length > 0 && !allowed.includes(model)) throw gatewayError('FORBIDDEN', 'The requested model is not allowed', 403);
  return model;
}

function upstreamError(status: number, detail = ''): GatewayError {
  const suffix = detail ? `: ${detail.slice(0, 240)}` : '';
  if (status === 401 || status === 403) return gatewayError('FORBIDDEN', `The AI service rejected the credentials or model${suffix}`, 502);
  if (status === 404) return gatewayError('PROVIDER_INVALID_RESPONSE', `The AI service endpoint or model was not found${suffix}`, 502);
  if (status === 429) return gatewayError('PROVIDER_RATE_LIMITED', `The AI service rate limit was reached${suffix}`, 429, true);
  if (status >= 500) return gatewayError('PROVIDER_UNAVAILABLE', `The AI service is temporarily unavailable${suffix}`, 502, true);
  return gatewayError('PROVIDER_INVALID_RESPONSE', `The AI service rejected the request${suffix}`, 502);
}

function upstreamDetail(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const body = value as Record<string, unknown>;
  const error = body.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const item = error as Record<string, unknown>;
    if (typeof item.message === 'string') return item.message;
    if (typeof item.code === 'string') return item.code;
  }
  if (typeof body.message === 'string') return body.message;
  return '';
}

function requestDispatcher() {
  const proxyUrl = process.env.AI_HTTP_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
  return proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
}

function requestTimeoutMs() {
  const configured = Number(process.env.AI_REQUEST_TIMEOUT_MS || 120_000);
  return Number.isFinite(configured) ? Math.min(300_000, Math.max(15_000, configured)) : 120_000;
}

async function requestJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const dispatcher = requestDispatcher();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs());
  try {
    const response = await request(url, {
      method: init.method || 'GET',
      headers: init.headers as Record<string, string> | undefined,
      body: typeof init.body === 'string' ? init.body : undefined,
      signal: controller.signal,
      ...(dispatcher ? { dispatcher } : {}),
    });
    const data: unknown = await response.body.json().catch(() => null);
    if (response.statusCode < 200 || response.statusCode >= 300) throw upstreamError(response.statusCode, upstreamDetail(data));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw gatewayError('PROVIDER_INVALID_RESPONSE', 'The AI service returned an invalid response', 502);
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw gatewayError('PROVIDER_TIMEOUT', 'The AI service timed out', 504, true);
    if (error instanceof TypeError || (error instanceof Error && /fetch failed|network|socket|connect|reset|dns/i.test(error.message))) {
      throw gatewayError('PROVIDER_UNAVAILABLE', 'Unable to reach the AI service. Check the Provider endpoint, local network, proxy, or firewall.', 502, true);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    if (dispatcher) await dispatcher.close();
  }
}

function baseUrl(provider: ProviderRecord) {
  return (provider.base_url || 'https://api.openai.com/v1').replace(/\/$/, '');
}

function extractOpenAiText(data: Record<string, unknown>): string {
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const message = choices[0] && typeof choices[0] === 'object' ? (choices[0] as Record<string, unknown>).message : null;
  const content = message && typeof message === 'object' ? (message as Record<string, unknown>).content : null;
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .filter((part): part is Record<string, unknown> => Boolean(part && typeof part === 'object'))
      .map(part => typeof part.text === 'string' ? part.text : '')
      .join('')
      .trim();
    if (text) return text;
  }
  throw gatewayError('PROVIDER_INVALID_RESPONSE', 'The AI response did not contain text', 502);
}

function extractGeminiText(data: Record<string, unknown>): string {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  const content = candidates[0] && typeof candidates[0] === 'object' ? (candidates[0] as Record<string, unknown>).content : null;
  const parts = content && typeof content === 'object' ? (content as Record<string, unknown>).parts : null;
  const text = Array.isArray(parts) ? parts.find((part) => part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string') : null;
  if (!text || typeof (text as Record<string, unknown>).text !== 'string') throw gatewayError('PROVIDER_INVALID_RESPONSE', 'The AI response did not contain text', 502);
  return (text as Record<string, unknown>).text as string;
}

export async function callVisionProvider(provider: ProviderRecord, model: string, image: { mimeType: string; data: string }, prompt: string) {
  const secret = decryptProviderSecret(provider.encrypted_api_key);
  if (provider.type.toLowerCase() === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret)}`;
    const data = await requestJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: image.mimeType, data: image.data } }] }] }),
    });
    return extractGeminiText(data);
  }

  const data = await requestJson(`${baseUrl(provider)}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }] }] }),
  });
  return extractOpenAiText(data);
}

export async function callTextProvider(provider: ProviderRecord, model: string, prompt: string) {
  const secret = decryptProviderSecret(provider.encrypted_api_key);
  if (provider.type.toLowerCase() === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret)}`;
    const data = await requestJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    return extractGeminiText(data);
  }

  const data = await requestJson(`${baseUrl(provider)}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: 'user', content: prompt }] }),
  });
  return extractOpenAiText(data);
}

export function parseJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  try {
    const value: unknown = JSON.parse(fenced.trim());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw gatewayError('PROVIDER_INVALID_RESPONSE', 'The AI response was not valid JSON', 502);
  }
}
