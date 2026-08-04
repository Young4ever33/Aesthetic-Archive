import { getCloudflareContext } from '@opennextjs/cloudflare';

/** Read server-only configuration from Node or the active Cloudflare Worker binding. */
export function getServerEnv(name: string): string | undefined {
  const nodeValue = process.env[name];
  if (nodeValue) return nodeValue;

  try {
    const { env } = getCloudflareContext();
    const value = (env as Record<string, unknown>)[name];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  } catch {
    // Cloudflare context is unavailable during a local Next build or Node execution.
    return undefined;
  }
}

/** Read a binding from the request-scoped Cloudflare context when sync context is unavailable. */
export async function getServerEnvAsync(name: string): Promise<string | undefined> {
  const nodeValue = process.env[name];
  if (nodeValue) return nodeValue;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const value = (env as Record<string, unknown>)[name];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}
