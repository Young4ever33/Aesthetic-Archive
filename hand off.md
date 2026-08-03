# Aesthetic Archive Hand Off

Updated: 2026-08-03 (Git, production readiness, and Prompt schema pass)
Project root: `A:/04-Pi Agent/01_Projects/05_AI产品优化/aesthetic-archive`

## Current State

The formal Next.js application is integrated at the project root. The application uses:

- `app/` for Next.js routes and pages
- `lib/` for server-side contracts, Supabase helpers, provider vault and AI gateway
- `public/local-mvp/` for the authenticated workspace UI
- `supabase/` for migrations and generated SQL
- Supabase Auth, Postgres, Storage and server-side API routes
- Server-side encrypted Provider secrets; the browser only receives Provider capability metadata such as `hasSecret`
- Server-side AI Gateway routes for image analysis, prompt generation and collage summaries

The project does not contain a Git repository. Do not assume branches, commits or worktrees are available.

## Completed In This Pass

- Corrected My Archive workflow order:
  1. Upload reference images and run AI analysis at the top.
  2. Review the generated draft below.
  3. Manually adjust generated fields.
  4. Save the aesthetic card.
- AI output remains editable after generation.
- Removed unnecessary explanatory microcopy from the personal profile fields in Settings, including editability and email-readonly notes.
- Reworked avatar controls:
  - Default avatars appear first.
  - Local image upload appears below default avatars.
  - Avatar preview is compact and aligned with the profile fields.
  - Name, email and contact inputs use the same normal control height.
  - Existing avatar URL storage compatibility is retained.
- Corrected Feedback / Opinion Box sidebar alignment:
  - Icon, Chinese label and English secondary label use the same left alignment pattern as other sidebar entries.
  - No special indentation or separate visual block remains.
- Completed the previous bilingual pass across the marketing page and major workspace views, including My Archive, card details, empty states, board summary, settings and action buttons.
- Fixed a CSS cascade issue where the later generic avatar rule could override the compact avatar dimensions.

## Verification Passed

Run these commands from the project root:

```bash
node --check public/local-mvp/app.js
pnpm typecheck
pnpm lint
pnpm build
```

All four checks passed on the latest update. The production build includes the root page, `/app`, `/auth`, Supabase-backed API routes, AI Gateway routes, feedback API and Proxy middleware.

## Important Files

- Workspace markup: `public/local-mvp/index.html`
- Workspace behavior and rendering: `public/local-mvp/app.js`
- Workspace styling: `public/local-mvp/styles.css`
- Marketing page: `app/page.tsx`
- Marketing styles: `app/marketing.css`
- AI Gateway: `lib/ai-gateway.ts`
- Provider secret vault: `lib/provider-vault.ts`
- Supabase server client: `lib/supabase/server.ts`
- Supabase admin client: `lib/supabase/admin.ts`
- Feedback API: `app/api/feedback/route.ts`
- Administrator review API and queue UI: `app/api/admin/reviews/route.ts`, `public/local-mvp/index.html`, `public/local-mvp/app.js`, `public/local-mvp/styles.css`
- Repository checks and deployment smoke script: `.github/workflows/check.yml`, `scripts/github-check.mjs`, `scripts/smoke-production.mjs`
- Seed Prompt migration: `scripts/update-seed-prompts.mjs`, `public/local-mvp/src/data/cases.json`, `public/local-mvp/src/data/cases.js`
- AI image analysis API: `app/api/ai/analyze-image/route.ts`
- AI prompt API: `app/api/ai/generate-prompt/route.ts`
- AI collage summary API: `app/api/ai/board-summary/route.ts`
- Release checklist: `docs/RELEASE_CHECKLIST.md`
- Environment template: `docs/ENVIRONMENT_TEMPLATE.md`

## Development

The known local development URL is:

- `http://localhost:5174`

Do not start a second server if port `5174` is already occupied by the project service. Check the process first. The project root `.env.local` is loaded by Next.js; do not expose its contents in chat, logs or handoff notes.

## Known Remaining Work

These items were not completed by this pass:

- Restart and retest the Agnes visual analysis request with the configured timeout. The latest known issue was a Provider timeout.
- Run the authenticated production smoke test: sign in with a real test account, create/edit/upload a card, call a real vision Provider, submit public review, approve/reject as reviewer, and verify audit rows plus public visibility behavior.
- Configure the production domain, HTTPS, Supabase Auth callback, SMTP, Provider secret, and administrator/reviewer accounts.
- Add broader browser-level regression tests and real authenticated AI smoke tests.
- Verify the full browser workflow for language switching, profile save, image upload, AI generation, editable AI results, category `Other`, multi-image collage selection, feedback submission and session persistence.
- Review legacy assets under `public/local-mvp/legacy/updated/` before any future cleanup. Do not delete or move them without checking current references.

## Safety Rules

- Never expose Provider API keys in browser storage, client requests, logs, backups or API responses.
- Do not restore old `.pi`, session, auth, model, settings or cache data.
- Do not use WorkBuddy or unrelated `npx` launchers to start Pi Web or occupy port `30141`.
- Do not kill or restart unrelated processes. Identify port owners before changing services.
- Preserve project material folders and existing user data.
- Use the product Toast, status areas and custom modals for user feedback; do not reintroduce browser `alert`, `confirm` or `prompt`.
- Keep Provider and AI calls server-side.
- Keep the My Archive workflow ordered as upload and AI generation first, manual review and editing second.
