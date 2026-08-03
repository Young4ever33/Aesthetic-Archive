# Production Release Checklist

## Application

- [ ] `pnpm install --frozen-lockfile` succeeds from the repository root.
- [ ] `pnpm lint` succeeds.
- [ ] `pnpm typecheck` succeeds.
- [ ] `pnpm build` succeeds.
- [ ] The production server starts from the repository root with `pnpm start`.
- [ ] `/` opens the marketing page and `/app` opens the workspace.
- [ ] Card detail overlays open, scroll, close, and render all gallery and metadata sections.
- [ ] Personal settings accept and persist a display name after refresh and after account sync.
- [ ] My Archive keeps manual fields before the image/AI section and visually distinguishes those sections.
- [ ] Prompt maximum length is enforced for Chinese, English, and negative prompts.

## Supabase

- [ ] All migrations in `supabase/migrations/` have been applied in order.
- [ ] RLS policies are enabled and tested with two separate user accounts.
- [ ] Auth Site URL and redirect URL use the production HTTPS domain.
- [ ] Email confirmation and password recovery work with production SMTP.
- [ ] Storage bucket policies prevent one user from reading another user's private images.
- [ ] A reviewer/admin account exists and its role is verified.

## Secrets and AI

- [ ] `.env.local` is present only in the deployment secret store and is not committed.
- [ ] `PROVIDER_ENCRYPTION_KEY` is a base64-encoded 32-byte key.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- [ ] No provider API key appears in browser localStorage, request payloads, response payloads, logs, screenshots, or backups.
- [ ] The deployment server can reach the configured AI provider without relying on a developer laptop or `127.0.0.1` proxy.
- [ ] Vision analysis succeeds with a small JPEG, PNG, and WebP image.
- [ ] AI timeout and provider errors show a request ID without exposing secrets.
- [ ] AI usage logging records success and failure without storing image data or API keys.

## User Flows

- [ ] Register, confirm email, sign in, refresh, and sign out.
- [ ] Create, edit, delete, and reload a private card.
- [ ] Upload multiple images and confirm signed URLs render after refresh.
- [ ] Add one image and all images from a card to the collage board without duplicate items.
- [ ] Save and unsave a public card.
- [ ] Submit a card for review, confirm it is not public while pending, and resubmit a rejected card.
- [ ] Reviewer can approve, reject, and unpublish cards.
- [ ] Feedback/report submission works and is visible to authorized staff only.
- [ ] Export and clear actions use in-product confirmation and do not use browser-native dialogs.

## Assets and Legal

- [ ] Every image under `public/` is owned, licensed for redistribution, or clearly marked as a non-production placeholder.
- [ ] `public/local-mvp/legacy/updated/selected_pic/` remains available while `cases.json` references it.
- [ ] Marketing and product assets have been checked for redistribution rights.
- [ ] No local screenshots, videos, exports, logs, or browser backups are included in the upload.

## Deployment and Monitoring

- [ ] HTTPS is enabled and security headers are present.
- [ ] Production logs redact authorization headers, cookies, provider keys, and image data.
- [ ] Error monitoring captures request IDs and route names.
- [ ] Health and smoke checks cover the homepage, auth callback, `/app`, `/api/profile`, `/api/cards`, and AI routes.
- [ ] Database backups and retention are configured.
- [ ] A rollback build or previous deployment is available.
- [ ] The final GitHub scan reports no secrets and no generated build directories.
