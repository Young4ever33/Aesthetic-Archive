import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getServerEnvAsync } from '@/lib/server-env';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

async function encryptionKey() {
  const encoded = await getServerEnvAsync('PROVIDER_ENCRYPTION_KEY');
  if (!encoded) throw new Error('PROVIDER_ENCRYPTION_KEY is not configured');

  const key = Buffer.from(encoded, 'base64');
  if (key.length !== KEY_BYTES) throw new Error('PROVIDER_ENCRYPTION_KEY must be a base64 encoded 32-byte key');
  return key;
}

export async function encryptProviderSecret(secret: string): Promise<string> {
  if (!secret.trim()) throw new Error('Provider secret cannot be empty');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, await encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export async function decryptProviderSecret(payload: string): Promise<string> {
  const parts = payload.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted Provider secret');
  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, 'base64url'));
  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) throw new Error('Invalid encrypted Provider secret');
  const decipher = createDecipheriv(ALGORITHM, await encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function redactProvider<T extends { encrypted_api_key?: string | null }>(provider: T) {
  const { encrypted_api_key: _secret, ...metadata } = provider;
  return { ...metadata, hasSecret: Boolean(_secret) };
}
