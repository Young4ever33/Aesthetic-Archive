# Aesthetic Archive Hand Off

Updated: 2026-08-03
Project root: `A:/04-Pi Agent/01_Projects/05_AI产品优化/aesthetic-archive`
Repository: `https://github.com/Young4ever33/Aesthetic-Archive`
Production URL: `https://aesthetic-archive.laverneyue33.workers.dev`
Provider fix baseline commit: `5db8f323b832f8f536fd84a0caba6346530d97c1`

## Executive Conclusion

The source code is buildable and the Cloudflare Worker bundle succeeds on GitHub's Ubuntu runner. The Supabase production schema is aligned through migration `202608030010`. The Provider gateway fixes and automatic deployment workflow are committed and pushed to `main`.

The release is **not yet production-complete**. GitHub Actions stopped before deployment because the Cloudflare deployment credentials are not configured for the repository or its `production` environment. Therefore commit `5db8f32` has not been proven to be the active production Worker version, and real Provider calls cannot be declared fixed in production yet.

Current release judgment:

- Source and standard Next.js build: **PASS**
- Linux OpenNext Cloudflare Worker build: **PASS**
- Supabase migration alignment: **PASS**
- Cloudflare automatic deployment workflow definition: **PASS**
- Cloudflare deployment execution: **BLOCKED**
- Production unauthenticated smoke test from this machine: **INCONCLUSIVE — local DNS/network anomaly**
- Production Provider save/test/vision/text/image calls: **NOT YET VERIFIED on the new Worker**

## Final Test Matrix

| Area | Result | Evidence / issue |
| --- | --- | --- |
| Seed Prompt v3 validation | PASS | 22/22 cards pass static validation; A-04 records user-accepted generation review; 21 cards remain generation-pending |
| ESLint | PASS | `pnpm lint` completed without errors |
| TypeScript | PASS | `pnpm typecheck` completed without errors |
| Repository safety check | PASS | No generated directories, sensitive filenames, obvious secrets, or oversized files detected |
| Next.js production build | PASS | Next.js 16.2.12 compiled and generated 27 routes |
| Local JS syntax | PASS | `node --check public/local-mvp/app.js` |
| Git diff hygiene | PASS | `git diff --check` |
| Linux OpenNext Worker build | PASS | GitHub Actions job `check`, run `30846903337`, completed successfully |
| Windows OpenNext build | ENVIRONMENT LIMIT | Next.js stage passed, then Windows denied a symlink with `EPERM`; OpenNext itself warns Windows is not fully supported. Ubuntu CI is the authoritative Worker-build result |
| Supabase remote migrations | PASS | Local and remote versions match from `202607300001` through `202608030010` |
| GitHub push | PASS | Local `HEAD` and `origin/main` both equal `5db8f323...` |
| Automatic production deploy | BLOCKED | `deploy-production` failed at `Verify Cloudflare deployment credentials`; deploy and smoke steps were skipped |
| Production smoke from this PC | INCONCLUSIVE | `workers.dev` resolved locally to abnormal Meta/X-associated addresses and connection timed out before any HTTP response |
| Authenticated Provider E2E | BLOCKED | Requires the new Worker deployment, a real signed-in browser session, and a Provider key stored through the product UI |

GitHub Actions evidence:

- Run: `https://github.com/Young4ever33/Aesthetic-Archive/actions/runs/30846903337`
- Commit: `5db8f323b832f8f536fd84a0caba6346530d97c1`
- `check`: success
- `pnpm check`: success
- `pnpm cloudflare:build`: success
- `deploy-production`: failure at credential preflight
- `Deploy production Worker`: skipped
- `Run production smoke checks`: skipped

## Provider Fixes Included in `5db8f32`

The Provider path was revised across save, connection test, vision, text, and image generation:

1. Provider types are normalized across `OpenAI`, `Gemini`, `OpenRouter`, `Custom Endpoint`, and supported historical aliases.
2. OpenAI-compatible Base URLs are normalized when users enter `/v1`, `/chat/completions`, `/responses`, `/images/generations`, or `/models` forms.
3. OpenAI-compatible text extraction supports:
   - `choices[].message.content` strings;
   - array content parts;
   - `choices[].text`;
   - `output_text`;
   - Responses-style `output[].content`.
4. Forced `temperature` was removed from compatible requests because some third-party models reject it.
5. OpenRouter receives `HTTP-Referer` and `X-Title` headers.
6. Non-JSON upstream responses now return bounded diagnostics instead of a generic invalid-response error.
7. Errors distinguish credential/model access, endpoint/model 404, quota/rate limit, timeout, upstream 5xx, and network failure.
8. Providers without a text model can run a real `/models` authentication probe instead of being rejected by the UI.
9. Providers with a text model still perform a real text-generation test.
10. Provider save/update validates model lists, default models, HTTPS Base URLs, encryption configuration, migration state, and database permissions.
11. User Provider keys remain encrypted server-side and are not returned to the browser.

Important limitation: these changes passed compilation and Worker bundling, but have not completed a real production upstream call because the new Worker was not deployed.

## Cloudflare Automatic Deployment

`.github/workflows/check.yml` now defines two gated jobs:

1. `check`
   - install with frozen lockfile;
   - run `pnpm check`;
   - run `pnpm cloudflare:build`.
2. `deploy-production`
   - runs only for a push to `main`;
   - waits for `check`;
   - validates Cloudflare deployment credentials;
   - runs `pnpm cloudflare:deploy`;
   - runs `pnpm smoke:production -- https://aesthetic-archive.laverneyue33.workers.dev`.

`wrangler.jsonc` includes `keep_vars: true`. Wrangler deployments should preserve application variables and secrets already managed in the Cloudflare Dashboard.

### Required GitHub Actions Secrets

Configure these in either repository Actions secrets or the `production` environment:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Do not send their values through chat or commit them. The API token should have the minimum permissions required to deploy the target Worker, including Workers Scripts edit access.

Do not move these application runtime values into GitHub:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
AI_REQUEST_TIMEOUT_MS
SUPABASE_SERVICE_ROLE_KEY
PROVIDER_ENCRYPTION_KEY
```

They remain in Cloudflare Dashboard. User Provider API keys remain in the encrypted Provider Vault, not in Cloudflare or GitHub.

After adding the two deployment secrets, re-run failed jobs for Actions run `30846903337`, or push a later commit to `main`. A successful run must show both `check` and `deploy-production` as green.

## Production DNS / Network Finding

The local production smoke command failed before receiving an HTTP response:

```text
TypeError: fetch failed
UND_ERR_CONNECT_TIMEOUT
```

Local DNS returned an abnormal address for the Worker hostname, including `157.240.0.35`; Node also attempted addresses in Meta/X-associated ranges. This is not a valid basis for diagnosing the Worker application itself. DNS-over-HTTPS checks also failed from this network.

Required follow-up:

1. Run the post-deploy smoke test from GitHub Actions, which uses an independent Ubuntu network.
2. Open production from a normal browser or another network.
3. If the hostname still resolves incorrectly, inspect the local/system DNS, VPN, filtering, hosts file, or network interception separately.
4. Do not change application code to compensate for the local DNS anomaly.

## Required Production Acceptance Order

Complete these steps in order after Cloudflare deployment succeeds:

1. Confirm the deployed commit/version corresponds to `5db8f32` or a later commit containing it.
2. Confirm Cloudflare Dashboard still contains all three normal variables and both encrypted runtime secrets.
3. Run the unauthenticated production smoke test and require all checks to pass.
4. Sign in with a real confirmed account.
5. Open Provider settings and edit/re-save the old Agnes Provider as:
   - type: `Custom Endpoint`;
   - Base URL: `https://apihub.agnes-ai.com/v1`;
   - model IDs exactly as exposed by that account/service;
   - API key entered only in the product UI.
6. Click `测试连接`:
   - with a text model, require a real non-empty text reply;
   - without a text model, require a successful authenticated model probe.
7. Run image analysis with the configured vision model and require structured JSON.
8. Run Prompt generation with the configured text model and require isolated Chinese/English positive and negative Prompts.
9. Run image generation only if the configured Custom Endpoint explicitly supports the OpenAI Images API contract.
10. Verify request IDs and `ai_usage_logs` record success/failure without credentials or image payloads.
11. Repeat with a second account and verify Provider ownership isolation.

Do not mark Provider production acceptance complete merely because connection testing passes. Vision, text, and image generation are distinct capabilities and must be tested independently.

## Known Remaining Issues

### Release blockers

- Cloudflare deployment credentials are missing from GitHub Actions.
- Commit `5db8f32` is not yet proven deployed to production.
- Provider production E2E is not verified with a real account and real upstream service.

### Non-blocking engineering issues

- Next.js warns that the `middleware` convention is deprecated in favor of `proxy`. The current build succeeds.
- OpenNext local Worker bundling on Windows can fail while creating symlinks. Use Ubuntu CI or WSL for authoritative Worker builds.
- The remaining 21 Seed cards have passed static Prompt v3 validation but still require real image-generation review.
- Production desktop/mobile regression, two-account social acceptance, and reviewer publication acceptance remain outstanding.

## Reproducible Commands

```bash
pnpm check
pnpm cloudflare:build
pnpm supabase:status
pnpm smoke:production -- https://aesthetic-archive.laverneyue33.workers.dev
git status --short --branch
git rev-parse HEAD origin/main
```

On this Windows machine, treat GitHub's Ubuntu `pnpm cloudflare:build` result as authoritative if local OpenNext fails only at symlink creation.

## Important Files

- Provider CRUD: `app/api/providers/route.ts`
- Provider connection test: `app/api/providers/test/route.ts`
- AI Gateway: `lib/ai-gateway.ts`
- Vision API: `app/api/ai/analyze-image/route.ts`
- Prompt API: `app/api/ai/generate-prompt/route.ts`
- Image generation API: `app/api/ai/generate-image/route.ts`
- Provider UI: `public/local-mvp/app.js`, `public/local-mvp/index.html`
- Cloudflare workflow: `.github/workflows/check.yml`
- Worker configuration: `wrangler.jsonc`, `open-next.config.ts`
- Deployment guide: `docs/DEPLOYMENT.md`
- Production smoke: `scripts/smoke-production.mjs`
- Production acceptance: `docs/PRODUCTION_ACCEPTANCE_SOCIAL_PROVIDER_PROMPT_V3.md`

## Repository State and Local-Only Material

- `main` and `origin/main` are aligned at `5db8f32` before this handoff document update.
- `Prompt Test images/` remains an untracked local evidence directory and must not be bulk-added to Git.
- Compressed README/marketing evidence images are already tracked under `docs/prompt-v3/validation/` and `public/marketing/`.
- No `.env`, `.env.local`, `.dev.vars`, Provider key, Supabase service key, encryption key, cookie, or authorization header was added to the repository.

## Safety Rules

- Never expose Provider keys, Supabase service credentials, encryption keys, cookies, or authorization headers in code, Git, logs, screenshots, handoff documents, or chat.
- Never run `supabase db reset` against the linked production project.
- Apply database changes through new migrations only.
- Do not rotate `PROVIDER_ENCRYPTION_KEY` without a data re-encryption migration.
- Keep Provider calls server-side and enforce owner isolation before decrypting secrets.
- Do not weaken TLS, disable certificate verification, add a proxy, or change API code to work around the current local DNS anomaly.
