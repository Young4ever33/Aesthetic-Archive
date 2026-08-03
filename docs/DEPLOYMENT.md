# Cloudflare Workers Deployment

Aesthetic Archive is a full-stack Next.js application. Deploy it to **Cloudflare Workers** through the OpenNext adapter. Do not use a static Cloudflare Pages deployment: authentication callbacks, server APIs, the Provider vault, AI Gateway, moderation, and feedback require a server runtime.

## GitHub Actions Deployment

Production deploys run from `.github/workflows/check.yml`. A push to `main` must pass `pnpm check` and `pnpm cloudflare:build`; only then does the `deploy-production` job publish the Worker and run production smoke checks.

Configure these repository or `production` environment secrets in GitHub:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

The API token should be scoped to the target account with Workers Scripts edit access and the minimum read permissions Wrangler requires. It is a deployment credential only. Do not copy Supabase keys, `PROVIDER_ENCRYPTION_KEY`, or user Provider keys into GitHub.

Keep the Worker name aligned with `wrangler.jsonc`: `aesthetic-archive`. The config uses `keep_vars: true`, so Wrangler deployments preserve the runtime variables and secrets already managed in the Cloudflare Dashboard. Avoid enabling a second Cloudflare Git-integration deployment for the same branch, because two independent deployment systems create ambiguous production versions.

The repository contains:

- `wrangler.jsonc`: Worker entry point, static assets, compatibility flags, and observability;
- `open-next.config.ts`: OpenNext Cloudflare adapter configuration;
- `pnpm cloudflare:build`: production-compatible Worker build;
- `pnpm cloudflare:preview`: local workerd preview for engineering verification only;
- `pnpm cloudflare:deploy`: build and deploy production;
- `pnpm cloudflare:upload`: build and upload a version without activating it.

## Cloudflare Variables and Secrets

Configure these only in **Cloudflare Dashboard → Worker → Settings → Variables and Secrets**. Do not create or commit local environment files. GitHub Actions preserves these values during deployment and does not receive them.

Public application variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
AI_REQUEST_TIMEOUT_MS=120000
```

Encrypted server secrets:

```text
SUPABASE_SERVICE_ROLE_KEY
PROVIDER_ENCRYPTION_KEY
```

`PROVIDER_ENCRYPTION_KEY` must be a Base64 string that decodes to exactly 32 bytes. Generate it in a secure secret-management session and store it directly in Cloudflare; never place it in GitHub, documentation, screenshots, build logs, or browser storage.

Do not configure `AI_HTTP_PROXY`, `HTTP_PROXY`, or `HTTPS_PROXY` in Cloudflare. The Worker calls configured AI Providers through Cloudflare outbound `fetch`.

Provider API keys are not global Cloudflare variables. Each authenticated user saves a Provider through the application; its key is encrypted with `PROVIDER_ENCRYPTION_KEY` and stored in Supabase.

## Supabase Production URLs

After Cloudflare issues the production `workers.dev` URL or the custom domain:

1. Set Supabase Auth **Site URL** to the final HTTPS product domain.
2. Add `https://YOUR_DOMAIN/auth/callback` to Supabase Auth redirect URLs.
3. If both `workers.dev` and a custom domain are used during rollout, add both callback URLs temporarily.
4. Replace the README product URL placeholder with the final domain.

## Build Verification

Before connecting production traffic, run:

```bash
pnpm check
pnpm cloudflare:build
```

After deployment, run:

```bash
pnpm smoke:production -- https://YOUR_DOMAIN
```

Then complete authenticated checks for sign-up/sign-in, Provider creation, image analysis, card persistence, saving, board persistence, review approval/rejection, public visibility, and anonymous feedback.

## Operational Notes

- Keep Cloudflare Worker logs enabled, but never log authorization headers, cookies, Provider keys, image data, or decrypted secrets.
- Use Cloudflare deployment versions for rollback.
- Rotate `SUPABASE_SERVICE_ROLE_KEY` through Supabase and Cloudflare together.
- Do not rotate `PROVIDER_ENCRYPTION_KEY` without a data re-encryption migration; changing it makes existing Provider secrets unreadable.
- Confirm every public seed image is licensed before public launch.
