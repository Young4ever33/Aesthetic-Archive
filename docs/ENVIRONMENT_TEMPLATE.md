# Cloudflare Production Variables

Aesthetic Archive production variables belong in **Cloudflare Dashboard → Worker → Settings → Variables and Secrets**. Do not create a local `.env`, `.env.local`, or `.dev.vars` for the production setup.

## Public Variables

These values are intentionally available to the browser bundle:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## Encrypted Secrets

Mark these as encrypted Cloudflare secrets:

```text
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
PROVIDER_ENCRYPTION_KEY=BASE64_ENCODED_32_BYTE_KEY
```

Security requirements:

- `PROVIDER_ENCRYPTION_KEY` must decode from Base64 to exactly 32 bytes.
- `SUPABASE_SERVICE_ROLE_KEY` and `PROVIDER_ENCRYPTION_KEY` must never appear in browser storage, API responses, logs, screenshots, GitHub Actions output, or repository history.
- Do not configure `AI_HTTP_PROXY`, `HTTP_PROXY`, or `HTTPS_PROXY` in Cloudflare. Production Provider calls use Cloudflare outbound `fetch`.
- Individual Provider API keys are entered by authenticated users, encrypted server-side, and stored in Supabase. They are not Cloudflare environment variables.
- Do not configure `AI_REQUEST_TIMEOUT_MS`. Provider calls are submitted once without an application deadline, automatic retry, image-quality reduction, or local substitute result.

After the final domain is available, configure the same HTTPS domain in Supabase Auth Site URL and add `/auth/callback` to the allowed redirect URLs.
