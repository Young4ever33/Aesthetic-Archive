# Aesthetic Archive

[中文说明 / Chinese README](./README.zh-CN.md)

Aesthetic Archive is a designer-focused visual knowledge workspace. It turns references into searchable cards, reusable prompts, private archives, collage boards, and a moderated public plaza.

## Product Status

The current codebase is a cloud-enabled Beta candidate built with Next.js, Supabase Auth/Postgres/Storage, and a server-side AI Gateway. Local browser drafts remain available when Supabase is not configured.

Before production release, complete the checklist in `docs/RELEASE_CHECKLIST.md`, verify image licensing, and run the real-provider smoke test in a production-like environment.

## Run Locally

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open:

- Marketing page: `http://localhost:5174/`
- Workspace: `http://localhost:5174/app`
- My Archive: `http://localhost:5174/app?tab=archive`
- Public Plaza: `http://localhost:5174/app?tab=plaza`

Production verification:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

## Architecture

- `app/`: Next.js routes, server APIs, authentication callback, and page styles.
- `lib/`: Supabase clients, validation, provider vault, AI Gateway, and usage logging.
- `public/local-mvp/`: browser workspace UI and the public seed dataset.
- `public/local-mvp/legacy/updated/selected_pic/`: referenced seed images; keep this directory unless all dataset paths are migrated.
- `public/marketing/` and `public/brand/`: product assets used by the application.
- `supabase/migrations/`: schema, RLS, Storage, security, observability, and feedback migrations.
- `docs/`: setup, deployment, product contracts, and release documentation.

The root directory is the only application directory. There is no active `apps/web` project path.

## Environment Variables

Copy `.env.example` to `.env.local` and fill values locally. Never commit `.env.local` or provider secrets.

Required server values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PROVIDER_ENCRYPTION_KEY` (base64-encoded 32-byte key)

Optional AI networking values:

- `AI_HTTP_PROXY`
- `HTTP_PROXY`
- `HTTPS_PROXY`
- `AI_REQUEST_TIMEOUT_MS`

Provider API keys are encrypted and stored server-side. The browser receives only provider metadata such as `hasSecret`; keys must not appear in localStorage, logs, backups, API responses, or Git history.

## Supabase Setup

1. Create a Supabase project.
2. Run the migrations in `supabase/migrations/` in filename order, or use `supabase/generated/apply_all_migrations.sql`.
3. Configure Auth Site URL and redirect URL for the deployment domain.
4. Enable the required email provider and create an admin/reviewer account according to the production checklist.
5. Configure the deployment server so it can reach the selected AI provider. A developer laptop proxy such as `127.0.0.1:7890` is not a production dependency.

See `docs/SUPABASE_SETUP.md` and `docs/DEPLOYMENT.md` for details.

## GitHub Upload Rules

Commit source code, migration files, public assets that are licensed for redistribution, `package.json`, `pnpm-lock.yaml`, and documentation. Do not commit:

- `.env`, `.env.local`, or any secret file
- `.next/`, `node_modules/`, logs, coverage, or local exports
- browser backups containing private cards or provider configuration
- unlicensed or unverified reference images
- screenshots and temporary QA material

## License and Assets

See `LICENSE`. Confirm that every public seed image is self-owned, licensed for redistribution, or replaced before commercial launch.
