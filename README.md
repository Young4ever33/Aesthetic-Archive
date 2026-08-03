# Aesthetic Archive

[中文说明 / Chinese README](./README.zh-CN.md)

> **Aesthetic Archive is an AI-powered aesthetic knowledge base for designers: a place to turn scattered visual references into searchable, explainable, and reusable design intelligence.**

Designers do not lack images. They lack a reliable way to remember why a reference matters, explain what makes it work, and reuse that knowledge in the next project.

Aesthetic Archive is built around that gap. It helps designers move from **saving references** to **building an aesthetic system**: one that can be searched, discussed, translated into prompts, arranged into project boards, and shared with a wider design community.

## The Problem

A reference library often grows faster than a designer can understand it.

- Images are scattered across Pinterest, folders, screenshots, chat threads, and project tools.
- A designer may recognize a feeling but struggle to describe its structure, cultural context, material language, or composition.
- Moodboards communicate atmosphere, but the reasoning behind them is easily lost.
- AI image generation is inconsistent when every prompt starts from scratch.
- Teams repeatedly rebuild the same visual vocabulary for different projects.

The result is a familiar loop: collect more, search longer, explain less, and recreate the same decisions from memory.

## The Product Idea

Aesthetic Archive treats a visual reference as more than an image. It is a unit of design knowledge.

Each reference can become a structured aesthetic card containing:

- visual facts and design elements;
- cultural context and considered interpretation;
- materials, lighting, geometry, typography, palette, and composition;
- practical use cases for future projects;
- Chinese and English image-generation prompts;
- negative prompts, confidence, source, and rights information.

The product combines a personal archive, a public aesthetic plaza, AI-assisted analysis, reusable Prompt Packs, and a Collage Board. Together they form a workflow for turning visual taste into working material.

## Who It Is For

### Spatial and landscape designers

For early research, material studies, spatial references, client presentations, and visual direction. Aesthetic Archive helps convert atmosphere into a vocabulary that can be discussed and reused.

### Graphic and brand designers

For collecting visual systems, editorial references, typography, composition, color relationships, and brand moodboards without losing the reasoning behind them.

### AI visual creators

For building repeatable style variables, bilingual prompts, negative constraints, and reference sets instead of relying on improvised prompting.

### Design students and emerging designers

For learning how to break down a style, trace its visual logic, and develop a personal reference system over time.

### Small studios and creative teams

For creating a shared visual language while keeping private project research separate from public inspiration.

## Market Entry and Opportunity

The first opportunity is not to compete as another image library or another generic AI image generator. It is to serve the workflow gap between the two.

Designers already collect references and increasingly use AI tools, but the knowledge between **reference**, **interpretation**, and **production** is still fragmented. Aesthetic Archive enters through a focused wedge:

1. help an individual designer organize their own aesthetic knowledge;
2. make that knowledge useful in the next project through cards, prompts, and boards;
3. let teams and the wider design community exchange reviewed aesthetic systems;
4. build a foundation for future collaboration, education, and design intelligence services.

The product is intentionally designer-first: visual, language-aware, source-conscious, and useful before it becomes a large social network or enterprise platform.

## Core Workflow

```text
Collect a reference
        ↓
Explain what is visible and why it matters
        ↓
Structure the aesthetic into a reusable card
        ↓
Generate bilingual prompts and project directions
        ↓
Arrange references on a Collage Board
        ↓
Reuse, export, review, or share the result
```

The key product loop is:

**Reference → Understanding → Aesthetic System → Prompt / Direction → Reuse**

## Product Modules

### Public Plaza

A moderated public library of aesthetic cases. Browse and search by style, color, composition, scene, use case, and prompt. Inspect a case, copy its prompts, save it, or add it to a Collage Board.

### My Archive

A private workspace for uploading references, creating aesthetic cards, editing structured analysis, connecting an AI Provider, and exporting reusable knowledge. Cards can remain private or enter the review workflow for public release.

### Saved

A personal layer for keeping useful public cases, adding project context, and collecting references for future work.

### Collage Board

A visual workspace for arranging references, adding notes, defining direction, summarizing a board, and preparing a more coherent project brief.

### Prompt Packs and Templates

Reusable analysis templates and bilingual Prompt Packs make the system more consistent across projects. Designers can tune the rules according to a discipline, studio, or personal method.

### Review Queue

Public publishing is not an automatic consequence of AI generation. Admin and reviewer roles can inspect submissions, approve or reject them, and preserve an audit trail before a card appears in the Public Plaza.

## Product Principles

- **A reference is evidence, not decoration.** Separate visible facts from interpretation and uncertainty.
- **AI assists judgment; it does not replace authorship.** The designer controls the template, edits the card, and decides what is reusable.
- **Private by default.** Project research and provider configuration remain protected unless explicitly shared.
- **Explainability over impressive output.** A useful card should tell a designer what to notice and how to act on it.
- **Source and rights matter.** Public cases need source and rights information, and uncertain claims should remain marked as uncertain.
- **Aesthetic knowledge should compound.** Every well-structured reference should make the next project faster and more intentional.

## Current Stage

Aesthetic Archive is an Open Beta / MVP foundation. The current product includes:

- a marketing page that explains the product story;
- a browser-based workspace with Public Plaza, My Archive, Saved, Collage, Provider, Settings, and Review Queue surfaces;
- local browser drafts when Supabase is not configured;
- Supabase Auth, Postgres, Storage, RLS, server-side APIs, provider encryption, AI Gateway routes, and moderation foundations;
- bilingual interface support in Chinese and English.

The production checklist still requires real Supabase credentials, deployed migrations, authenticated smoke tests, Provider validation, image-rights verification, and deployment configuration. See `docs/RELEASE_CHECKLIST.md` before treating the project as production-ready.

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

Before opening a pull request:

```bash
pnpm check
```

This runs lint, type checking, repository safety checks, and the production build.

## Technical Foundation

- `app/`: Next.js pages, server APIs, authentication callback, and marketing styles.
- `lib/`: Supabase clients, validation, provider vault, AI Gateway, and usage logging.
- `public/local-mvp/`: browser workspace UI and public seed dataset.
- `public/marketing/` and `public/brand/`: product assets used by the application.
- `supabase/migrations/`: schema, RLS, Storage, security, observability, and feedback migrations.
- `docs/`: product contracts, setup, deployment, QA, and release documentation.

The root directory is the only active application directory. There is no active `apps/web` path.

## Configuration and Security

Copy `.env.example` to `.env.local` for local development. Never commit `.env.local` or any secret.

Required server values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PROVIDER_ENCRYPTION_KEY` (base64-encoded 32-byte key)

Optional networking values:

- `AI_HTTP_PROXY`
- `HTTP_PROXY`
- `HTTPS_PROXY`
- `AI_REQUEST_TIMEOUT_MS`

Provider API keys are encrypted and stored server-side. They must never appear in localStorage, browser backups, API responses, logs, or Git history. The browser receives only non-secret metadata such as `hasSecret`.

## Supabase and Release Setup

1. Create a Supabase project.
2. Run the migrations in `supabase/migrations/` in filename order, or use `supabase/generated/apply_all_migrations.sql`.
3. Configure the production Site URL, redirect URL, email provider, and SMTP.
4. Create and verify admin and reviewer accounts.
5. Configure the deployment server so it can reach the selected AI Provider.
6. Run authenticated production-like smoke tests for login, cards, AI routes, saving, moderation, and feedback.

See `docs/SUPABASE_SETUP.md`, `docs/DEPLOYMENT.md`, and `docs/RELEASE_CHECKLIST.md`.

## Assets and License

See `LICENSE`. Before commercial launch, confirm that every public seed image is self-owned, licensed for redistribution, or replaced. Do not publish unverified reference images, private browser exports, screenshots, or temporary QA material.

## Roadmap Direction

The next product questions are about depth rather than breadth:

- Can a designer trust the explanation enough to use it in a real project?
- Can a personal archive become more useful with every new reference?
- Can reviewed public cases form a high-signal design knowledge layer?
- Can boards, prompts, and templates shorten the distance from inspiration to a defensible design direction?

Those questions guide the Beta: build a durable aesthetic workflow before adding unnecessary social or automation complexity.
