# Cloudflare Workers Deployment

Aesthetic Archive is a full-stack Next.js application deployed to **Cloudflare Workers** through the OpenNext adapter. Do not use a static Cloudflare Pages deployment: authentication callbacks, server APIs, the Provider vault, AI Gateway, moderation, and feedback require a server runtime.

## Production Deployment Owner

Cloudflare's Git integration is the single production deployment path:

```text
GitHub main push
→ Cloudflare Git integration builds the repository
→ Cloudflare activates the new Worker version
```

The connected repository is `Young4ever33/Aesthetic-Archive`, the production branch is `main`, and the Worker is `aesthetic-archive`.

Do not add a second Wrangler deployment job to GitHub Actions while this integration remains active. Two independent deployment systems create duplicate versions and ambiguous production ownership.

GitHub Actions in `.github/workflows/check.yml` performs quality checks only:

- install with the frozen lockfile;
- run `pnpm check`;
- run `pnpm cloudflare:build` on Ubuntu.

It does not require `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` and does not publish production.

## Verify a Production Deployment

After a push to `main`:

1. Confirm GitHub Actions `Repository checks` is green.
2. Open **Cloudflare Dashboard → Workers 和 Pages → aesthetic-archive → 部署**.
3. Confirm the latest version references the expected GitHub commit.
4. Confirm it is shown under **可用部署** as **已部署** with **流量百分比 100%**.
5. Confirm the Worker error rate remains normal.
6. Open the production URL and complete the authenticated acceptance checklist.

Cloudflare version IDs are not Git commit SHAs. Match deployments by commit message, source repository, branch, timestamp, and commit ancestry.

The repository also contains manual engineering commands:

- `pnpm cloudflare:build`: production-compatible Worker build;
- `pnpm cloudflare:preview`: local workerd preview;
- `pnpm cloudflare:deploy`: manual deployment for an explicitly approved recovery procedure;
- `pnpm cloudflare:upload`: upload a version without activating it.

Do not run the manual deployment commands in normal operation while Cloudflare Git deployment is active.

## Cloudflare Variables and Secrets

Configure these only in **Cloudflare Dashboard → Worker → 设置 → 变量和机密**. Do not create or commit local environment files.

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

`PROVIDER_ENCRYPTION_KEY` must be a Base64 string that decodes to exactly 32 bytes. Never place it in GitHub, documentation, screenshots, build logs, or browser storage. Do not rotate it without a data re-encryption migration.

Do not configure `AI_HTTP_PROXY`, `HTTP_PROXY`, or `HTTPS_PROXY` in Cloudflare. The Worker calls configured AI Providers through Cloudflare outbound `fetch`.

Provider API keys are not global Cloudflare variables. Each authenticated user saves a Provider through the application; its key is encrypted with `PROVIDER_ENCRYPTION_KEY` and stored in Supabase.

## Supabase Production URLs

Supabase Auth must use the final HTTPS product domain as its Site URL and allow:

```text
https://aesthetic-archive.laverneyue33.workers.dev/auth/callback
```

If a custom domain is introduced, add its callback before moving traffic and retain the `workers.dev` callback during rollout if both addresses remain valid.

## Verification Commands

Before pushing:

```bash
pnpm check
pnpm cloudflare:build
```

After Cloudflare activates a deployment, run from a network that resolves `workers.dev` correctly:

```bash
pnpm smoke:production -- https://aesthetic-archive.laverneyue33.workers.dev
```

Then complete authenticated checks for sign-in, Provider creation, connection testing, image analysis, Prompt generation, image generation where supported, card persistence, social interactions, review publication, and account isolation.

## Operational Notes

- Keep Cloudflare Worker logs enabled, but never log authorization headers, cookies, Provider keys, image data, or decrypted secrets.
- Use Cloudflare deployment versions for rollback.
- Rotate `SUPABASE_SERVICE_ROLE_KEY` through Supabase and Cloudflare together.
- Confirm every public seed image is licensed before public launch.
