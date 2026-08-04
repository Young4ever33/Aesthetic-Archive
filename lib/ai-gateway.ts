import { decryptProviderSecret } from './provider-vault';
import { getServerEnvAsync } from './server-env';
import { createSupabaseServerClient } from './supabase/server';
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
  generation_models: unknown;
  text_models: unknown;
  default_image_model: string | null;
  default_generation_model: string | null;
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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_owned_provider_secret', { p_provider_id: providerId }).maybeSingle();
  const provider = data as ProviderRecord | null;

  if (error) throw gatewayError('INTERNAL_ERROR', 'Unable to load Provider securely. Apply migration 202608030011', 500);
  if (!provider || provider.owner_id !== userId) throw gatewayError('PROVIDER_NOT_FOUND', 'Provider was not found', 404);
  return provider;
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

export function resolveModel(provider: ProviderRecord, requested: unknown, kind: 'image' | 'generation' | 'text'): string {
  const requestedModel = typeof requested === 'string' ? requested.trim() : '';
  const allowed = modelList(kind === 'image' ? provider.image_models : kind === 'generation' ? provider.generation_models : provider.text_models);
  const fallback = kind === 'image' ? provider.default_image_model : kind === 'generation' ? provider.default_generation_model : provider.default_text_model;
  const model = requestedModel || fallback || allowed[0] || '';
  if (!model) throw gatewayError('INVALID_REQUEST', `No ${kind} model is configured`, 400);
  if (allowed.length > 0 && !allowed.includes(model)) throw gatewayError('FORBIDDEN', 'The requested model is not allowed', 403);
  return model;
}

function upstreamError(status: number, detail = ''): GatewayError {
  const suffix = detail ? `: ${detail.slice(0, 240)}` : '';
  if (status === 401 || status === 403) return gatewayError('FORBIDDEN', `The AI service rejected the API key, account, or model access${suffix}`, 502);
  if (status === 404) return gatewayError('PROVIDER_INVALID_RESPONSE', `The AI service endpoint or model was not found. Verify that Base URL ends at the API version, for example /v1${suffix}`, 502);
  if (status === 408) return gatewayError('PROVIDER_TIMEOUT', `The AI service timed out${suffix}`, 504, true);
  if (status === 429) return gatewayError('PROVIDER_RATE_LIMITED', `The AI service rate limit or account quota was reached${suffix}`, 429, true);
  if (status >= 500) return gatewayError('PROVIDER_UNAVAILABLE', `The AI service is temporarily unavailable${suffix}`, 502, true);
  return gatewayError('PROVIDER_INVALID_RESPONSE', `The AI service rejected the request (HTTP ${status})${suffix}`, 502);
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

async function requestTimeoutMs() {
  const configured = Number((await getServerEnvAsync('AI_REQUEST_TIMEOUT_MS')) || 120_000);
  return Number.isFinite(configured) ? Math.min(300_000, Math.max(15_000, configured)) : 120_000;
}

async function requestJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), await requestTimeoutMs());
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    let data: unknown = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    if (!response.ok) throw upstreamError(response.status, upstreamDetail(data) || raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw gatewayError('PROVIDER_INVALID_RESPONSE', `The AI service returned a non-JSON response${raw ? `: ${raw.slice(0, 160)}` : ''}`, 502);
    }
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw gatewayError('PROVIDER_TIMEOUT', 'The AI service timed out', 504, true);
    if (error instanceof TypeError || (error instanceof Error && /fetch failed|network|socket|connect|reset|dns/i.test(error.message))) {
      throw gatewayError('PROVIDER_UNAVAILABLE', 'Unable to reach the AI service. Check the Provider endpoint and Cloudflare outbound connectivity.', 502, true);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeProviderType(value: string) {
  const type = value.trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (type === 'google' || type === 'google gemini') return 'gemini';
  if (type === 'open router') return 'openrouter';
  if (type === 'custom' || type === 'openai compatible' || type === 'openai compatible endpoint') return 'custom endpoint';
  return type;
}

function baseUrl(provider: ProviderRecord) {
  const type = normalizeProviderType(provider.type);
  const defaultUrl = type === 'openrouter'
    ? 'https://openrouter.ai/api/v1'
    : 'https://api.openai.com/v1';
  const configured = (provider.base_url || defaultUrl).replace(/\/+$/, '');
  return configured.replace(/\/(?:chat\/completions|responses|images\/generations|models)$/i, '');
}

function providerHeaders(provider: ProviderRecord, secret: string) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secret}`,
    'User-Agent': 'Aesthetic-Archive/0.1',
  };
  if (normalizeProviderType(provider.type) === 'openrouter') {
    headers['HTTP-Referer'] = 'https://aesthetic-archive.laverneyue33.workers.dev';
    headers['X-Title'] = 'Aesthetic Archive';
  }
  return headers;
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .filter((part): part is Record<string, unknown> => Boolean(part && typeof part === 'object'))
    .map((part) => {
      if (typeof part.text === 'string') return part.text;
      if (part.text && typeof part.text === 'object' && typeof (part.text as Record<string, unknown>).value === 'string') return (part.text as Record<string, unknown>).value as string;
      if (typeof part.content === 'string') return part.content;
      return '';
    })
    .join('')
    .trim();
}

function extractOpenAiText(data: Record<string, unknown>): string {
  for (const key of ['output_text', 'text', 'content', 'response', 'result']) {
    const value = textFromContent(data[key]);
    if (value) return value;
  }
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const choice = choices[0] && typeof choices[0] === 'object' ? choices[0] as Record<string, unknown> : null;
  const message = choice?.message && typeof choice.message === 'object' ? choice.message as Record<string, unknown> : null;
  const choiceText = textFromContent(message?.content)
    || textFromContent(message?.reasoning_content)
    || textFromContent(choice?.text)
    || textFromContent(choice?.content);
  if (choiceText) return choiceText;
  const output = Array.isArray(data.output) ? data.output : [];
  const outputText = output
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => textFromContent(item.content) || textFromContent(item.text))
    .join('')
    .trim();
  if (outputText) return outputText;
  console.error('Provider response contained no readable text', { responseKeys: Object.keys(data).slice(0, 20), choiceKeys: choice ? Object.keys(choice).slice(0, 20) : [] });
  throw gatewayError('PROVIDER_INVALID_RESPONSE', 'The AI response succeeded but did not contain readable text', 502);
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
  const secret = await decryptProviderSecret(provider.encrypted_api_key);
  if (normalizeProviderType(provider.type) === 'gemini') {
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
    headers: providerHeaders(provider, secret),
    body: JSON.stringify({ model, temperature: 0.2, max_tokens: 4_000, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }] }] }),
  });
  return extractOpenAiText(data);
}

export async function callImageGenerationProvider(provider: ProviderRecord, model: string, prompt: string, options: { count: number; size: '1024x1024' | '1536x1024' | '1024x1536' }) {
  const type = normalizeProviderType(provider.type);
  if (type !== 'openai' && type !== 'custom endpoint') {
    throw gatewayError('INVALID_REQUEST', 'Image generation currently supports OpenAI and explicit OpenAI-compatible Custom Endpoints only', 400);
  }
  const secret = await decryptProviderSecret(provider.encrypted_api_key);
  const data = await requestJson(`${baseUrl(provider)}/images/generations`, {
    method: 'POST',
    headers: providerHeaders(provider, secret),
    body: JSON.stringify({ model, prompt, n: options.count, size: options.size }),
  });
  const rows = Array.isArray(data.data) ? data.data : [];
  const images = rows.map((item) => {
    if (!item || typeof item !== 'object') return '';
    const record = item as Record<string, unknown>;
    if (typeof record.url === 'string' && /^https:\/\//i.test(record.url)) return record.url;
    if (typeof record.b64_json === 'string' && record.b64_json.length > 0) return `data:image/png;base64,${record.b64_json}`;
    return '';
  }).filter(Boolean).slice(0, options.count);
  if (!images.length) throw gatewayError('PROVIDER_INVALID_RESPONSE', 'The image service did not return an image URL or base64 image', 502);
  return images;
}

export async function probeProvider(provider: ProviderRecord) {
  const secret = await decryptProviderSecret(provider.encrypted_api_key);
  if (normalizeProviderType(provider.type) === 'gemini') {
    const data = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(secret)}`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'Aesthetic-Archive/0.1' },
    });
    return Array.isArray(data.models) ? data.models.length : 0;
  }
  const data = await requestJson(`${baseUrl(provider)}/models`, {
    method: 'GET',
    headers: providerHeaders(provider, secret),
  });
  return Array.isArray(data.data) ? data.data.length : 0;
}

export async function callTextProvider(provider: ProviderRecord, model: string, prompt: string) {
  const secret = await decryptProviderSecret(provider.encrypted_api_key);
  if (normalizeProviderType(provider.type) === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret)}`;
    const data = await requestJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    return extractGeminiText(data);
  }

  const data = await requestJson(`${baseUrl(provider)}/chat/completions`, {
    method: 'POST',
    headers: providerHeaders(provider, secret),
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
  });
  return extractOpenAiText(data);
}

export function parseJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const trimmed = fenced.trim().replace(/^\uFEFF/, '');
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  const candidates = [trimmed, firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : ''];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const value: unknown = JSON.parse(candidate);
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch {
      // Try the next bounded JSON candidate.
    }
  }
  throw gatewayError('PROVIDER_INVALID_RESPONSE', 'The AI response was not valid JSON', 502);
}
