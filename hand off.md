# Aesthetic Archive Hand Off

Updated: 2026-08-03 (Supabase production migration, Cloudflare Workers deployment, and Auth verification)
Project root: `A:/04-Pi Agent/01_Projects/05_AI产品优化/aesthetic-archive`
Production: `https://aesthetic-archive.laverneyue33.workers.dev`
Repository: `https://github.com/Young4ever33/Aesthetic-Archive`

## Current State

Aesthetic Archive is a root-level Next.js full-stack application deployed to Cloudflare Workers through `@opennextjs/cloudflare`. It uses:

- `app/` for marketing, authentication, workspace routing, server APIs, and Auth callback;
- `lib/` for Supabase clients, validation, Provider encryption, and the AI Gateway;
- `public/local-mvp/` for the authenticated workspace interface;
- `supabase/migrations/` for the production database contract;
- Supabase Auth, Postgres, private Storage, RLS, and server-side moderation;
- per-user encrypted Provider secrets; the browser receives only non-secret Provider metadata;
- Cloudflare Worker variables and encrypted secrets, with no committed or local production environment file.

The Git repository uses `main`, tracks `origin/main`, and deploys automatically from GitHub to the `aesthetic-archive` Worker.

## Production Verified

- Cloudflare OpenNext deployment completed successfully.
- The public marketing page is externally reachable at the production URL.
- All ten Supabase migrations through `202608030006_reconcile_production_security.sql` are applied.
- A post-migration read-only security audit passed:
  - anonymous feedback owner IDs are nullable and accepted by policy;
  - `anon` and `authenticated` cannot select `ai_providers.encrypted_api_key`;
  - authenticated users retain Provider metadata access;
  - reviewer updates have an admin `WITH CHECK` guard;
  - `card-images` is private with one owner-scoped policy per CRUD action.
- Email signup is enabled; anonymous sign-in and manual account linking are disabled.
- A real production user completed signup, received the confirmation email, returned through `/auth/callback`, entered `/app`, and appeared as confirmed in Supabase Auth.
- GitHub Actions passes the standard repository checks and Linux OpenNext Cloudflare build.

## Production Configuration

Cloudflare public variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `AI_REQUEST_TIMEOUT_MS=120000`

Cloudflare encrypted secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `PROVIDER_ENCRYPTION_KEY`

Provider API keys are entered per user in the application, encrypted server-side, and stored in Supabase. Do not add Provider API keys as global Cloudflare variables.

Supabase Auth is configured with the production Site URL and:

- `https://aesthetic-archive.laverneyue33.workers.dev/auth/callback`

## Important Files

- Marketing page: `app/page.tsx`, `app/marketing.css`
- Auth and callback: `app/auth/page.tsx`, `app/auth/callback/route.ts`
- Edge session middleware: `middleware.ts`
- Workspace: `public/local-mvp/index.html`, `public/local-mvp/app.js`, `public/local-mvp/styles.css`
- AI Gateway: `lib/ai-gateway.ts`
- Provider vault: `lib/provider-vault.ts`
- Review API: `app/api/admin/reviews/route.ts`
- Feedback API: `app/api/feedback/route.ts`
- Cloudflare: `wrangler.jsonc`, `open-next.config.ts`, `docs/DEPLOYMENT.md`
- Supabase: `supabase/config.toml`, `supabase/migrations/`, `docs/SUPABASE_SETUP.md`
- Verification: `.github/workflows/check.yml`, `scripts/github-check.mjs`, `scripts/smoke-production.mjs`

## Next Product Pass: Prompt System

The next planned pass is a content and schema redesign of all reusable Prompt cards and AI image-analysis Prompt outputs. Treat this as one coordinated system rather than isolated copy edits.

1. Inventory every Prompt source: seed cards, AI analysis templates, Prompt generation templates in Personal Settings, bilingual card fields, Negative Prompt output, and collage summary prompts.
2. Define one canonical bilingual schema with clear sections such as subject, style/context, composition/camera, material/light/color, constraints, use cases, editable variables, and negative constraints.
3. Separate visual evidence from inference. Generated cards must distinguish observed image facts, design interpretation, cultural references, and user-provided context.
4. Improve Prompt portability across model families. Keep a semantic core, then add optional adapters for image model syntax instead of mixing provider-specific flags into every card.
5. Add quality rules: no invented provenance, unsupported designer attribution, contradictory materials, generic filler, duplicated sections, or Chinese text inside English Prompt fields.
6. Make templates selectable and editable in Personal Settings, with a safe default, custom template validation, length controls, versioning, and reset behavior.
7. Upgrade seed Prompt cards in `public/local-mvp/src/data/cases.json`, regenerate `cases.js`, and align the seed migration/update script.
8. Test with a representative image set across spatial design, graphic/brand/UI, photography, moving image, and AI visual creation before publishing the revised cards.

## Remaining Verification

- Configure and test a real image-capable Provider through the production UI.
- Verify image analysis, bilingual Prompt generation, Negative Prompt generation, usage logging, timeout handling, and request IDs.
- Create/edit/delete/reload private cards and verify private Storage URLs after refresh.
- Test save/unsave and Collage persistence with a real authenticated account.
- Create reviewer/admin roles and verify submit, reject, resubmit, approve, unpublish, audit history, and Public Plaza visibility.
- Submit authenticated and anonymous feedback and verify staff-only access.
- Configure custom SMTP before public launch; Supabase default email is suitable only for limited testing.
- Run desktop/mobile browser regression and verify language switching, file controls, Prompt alignment, Feedback, Review Queue, and marketing layout.
- Review image redistribution rights and replace any production placeholder assets.

## Safety Rules

- Never expose Supabase service credentials, Provider keys, decrypted secrets, cookies, or authorization headers in code, Git, logs, screenshots, or chat.
- Never run `supabase db reset` against the linked production project.
- Apply future database changes through new migrations; do not manually drift Dashboard policies away from Git history.
- Do not rotate `PROVIDER_ENCRYPTION_KEY` without a data re-encryption migration.
- Keep Provider and AI calls server-side and enforce ownership before service-role access.
- Use in-product statuses, Toasts, and custom modals; do not introduce browser-native `alert`, `confirm`, or `prompt`.
- Preserve existing project data, archive assets, and user content.
