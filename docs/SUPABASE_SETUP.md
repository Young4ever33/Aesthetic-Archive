# Supabase Setup

Aesthetic Archive uses Supabase Auth + Postgres + Storage for the first cloud beta.

## Required environment variables

Configure these in the local development environment or deployment platform secret manager. Do not commit the actual values.

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=SERVER_ONLY_SERVICE_ROLE_KEY
PROVIDER_ENCRYPTION_KEY=BASE64_ENCODED_32_BYTE_KEY
```

Generate the server-only encryption key locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`NEXT_PUBLIC_*` values are public Supabase client configuration. `PROVIDER_ENCRYPTION_KEY` is server-only and must never be exposed to the browser, returned by an API, or written to logs.

## Database setup

Apply the existing schema migrations in order, then apply the four production migrations:

```text
supabase/migrations/202608030001_production_security.sql
supabase/migrations/202608030002_private_storage_and_runtime.sql
supabase/migrations/202608030003_ai_usage_observability.sql
supabase/migrations/202608030004_feedback_reports.sql
```

The production migrations:

- `202608030001_production_security.sql` adds role and publication status constraints;
- `202608030002_private_storage_and_runtime.sql` protects private image storage and adds runtime indexes;
- `202608030003_ai_usage_observability.sql` adds request IDs and duration fields to AI usage logs;
- `202608030004_feedback_reports.sql` adds user feedback and report tracking;

The production security migration also:
- revokes client SELECT access to `ai_providers.encrypted_api_key`;
- narrows normal card updates;
- protects card image objects under a per-user storage folder;
- keeps admin moderation as a server-side operation.

The old migrations are retained as historical schema references. Do not restore the deleted client-side Supabase code or put the Provider secret back into browser localStorage.

## Session behavior

`proxy.ts` refreshes the Supabase cookie session for `/app` and `/api`. Server code should use `requireUser()` from `lib/supabase/server.ts`; do not trust a user ID from request JSON or query parameters.

## Local AI proxy

Node.js does not automatically use the desktop VPN HTTP proxy. For local Agnes or other Provider access, set the proxy only in the terminal that starts Next.js:

```powershell
$env:AI_HTTP_PROXY="http://127.0.0.1:7890"
pnpm dev
```

Use the actual HTTP or mixed port shown by the VPN client. Do not put a Provider API key or a local proxy URL in browser code. Production should use a server network that can reach the Provider directly or a deployment-managed proxy, not a user's desktop VPN.

## Provider secret behavior

Use `POST /api/providers` with an authenticated session:

```json
{
  "name": "My Provider",
  "type": "openai-compatible",
  "secret": "provider-secret",
  "baseUrl": "https://api.example.com/v1",
  "imageCapable": true,
  "imageModels": ["vision-model"],
  "textModels": ["text-model"]
}
```

The server encrypts the secret with AES-256-GCM before inserting it into `ai_providers.encrypted_api_key`. GET and POST responses return metadata plus `hasSecret`; they never return the secret or ciphertext.

AI Gateway routes must decrypt the secret only inside a Node.js server route immediately before an upstream Provider call. They must not log or persist the plaintext. Because client roles cannot select `encrypted_api_key`, an AI Gateway route must first authenticate the user with `requireUser()`, verify Provider ownership, and then use `createSupabaseAdminClient()` only for the narrowly scoped secret lookup. The service-role client must never be imported by browser code or used without an ownership check.

## Required verification after configuration

1. Sign up a test user and verify email.
2. Confirm `/api/providers` returns `401` while signed out.
3. Save a Provider and confirm the response contains `hasSecret: true` but no `secret`, `apiKey`, or `encrypted_api_key`.
4. Confirm a second user cannot list, update, or delete the first user's Provider.
5. Inspect browser Network and application storage for absence of the Provider secret.
6. Rotate `PROVIDER_ENCRYPTION_KEY` only with a planned data re-encryption migration; changing it blindly makes existing Provider secrets undecryptable.
