# Aesthetic Archive Deployment Guide

Current target: production Next.js beta deployment. The repository root is the application root; there is no `apps/web` project. Use the root build and start commands below.

## Recommended: Vercel or Node Hosting

1. Import the GitHub repository and select Next.js from the repository root.
2. Configure every variable from `docs/ENVIRONMENT_TEMPLATE.md` in the production secret store.
3. Run `pnpm install --frozen-lockfile` and `pnpm build` during deployment.
4. Start with `pnpm start` or the platform's managed Next.js runtime.
5. Configure Supabase Auth Site URL and callback URL for the production HTTPS domain.
6. Create or verify a `reviewer`/`admin` profile and run the smoke test in `docs/RELEASE_CHECKLIST.md`.

GitHub Pages and static-only hosting are not compatible with the current server-side Auth, Supabase, Provider vault, and AI Gateway routes.

## Pre-Deploy Checklist

- [ ] `index.html` opens.
- [ ] `src/data/cases.js` loads.
- [ ] Case cards render.
- [ ] Task search returns results.
- [ ] Prompt copy works.
- [ ] Save case updates local saved list.
- [ ] Markdown / JSON export works.
- [ ] Feedback form logs locally.
- [ ] Image / URL analysis lab works in local draft mode.
- [ ] `docs/PRODUCT_PRD_UI_STANDARD.md` is included.
- [ ] `docs/PHASED_BUILD_PLAN.md` is included.
- [ ] No links point to removed legacy API/payment/Supabase docs.

## Open Beta Notes

- The early version is free to use.
- AI analysis should be implemented through custom AI Provider settings before any hosted API plan.
- API keys should remain local in the browser during the Open Beta stage unless a secure backend is added later.
- Demo images and references must be replaced with licensed, self-owned, public-domain, or user-uploaded assets before commercial use.

## Future Production Notes

After Open Beta evidence:

- Add hosted AI only if there is validated demand.
- Add account system and secure key storage only when necessary.
- Add usage tracking and rate limits for hosted AI.
- Add Pro / Team plans after My Archive and Collage usage is validated.
- Add real backend persistence for user archives, feedback and boards.
