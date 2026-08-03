# Supabase Setup

Aesthetic Archive uses Supabase Auth + Postgres + Storage for the first cloud beta.

## Required production variables

Configure the values from `docs/ENVIRONMENT_TEMPLATE.md` directly in Cloudflare Worker Variables and Secrets. Do not create a local environment file for the production setup.

`NEXT_PUBLIC_*` values are public Supabase client configuration. `SUPABASE_SERVICE_ROLE_KEY` and `PROVIDER_ENCRYPTION_KEY` are server-only Cloudflare secrets; they must never be exposed to the browser, returned by an API, committed to GitHub, or written to logs.

## Database setup

Use the Supabase CLI against the existing hosted project. Authenticate the CLI, link the project by its project ref, compare local and remote history, perform a dry run, and only then push:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
pnpm exec supabase migration list --linked
pnpm exec supabase db push --linked --dry-run
pnpm exec supabase db push --linked
```

Migrations are applied from `supabase/migrations/` in filename order. The remote project is production data: never use `db reset`, and do not use `--include-all` until migration history and the existing schema have been reconciled.

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

`middleware.ts` refreshes the Supabase cookie session for `/app` and `/api`. It uses the Edge Middleware convention required by the Cloudflare OpenNext adapter. Server code should use `requireUser()` from `lib/supabase/server.ts`; do not trust a user ID from request JSON or query parameters.

## Production Provider networking

Cloudflare Workers call configured AI Providers through outbound `fetch`. Do not configure desktop proxy addresses or `AI_HTTP_PROXY`, `HTTP_PROXY`, or `HTTPS_PROXY` in Cloudflare. Provider API keys remain encrypted per user in Supabase and are never stored as global Cloudflare variables.

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
