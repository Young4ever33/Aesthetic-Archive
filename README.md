# Aesthetic Archive

[中文 README](./README.zh-CN.md)

> **Aesthetic Archive is an AI-powered aesthetic knowledge workspace for designers. It turns scattered visual references into searchable, explainable, and reusable design intelligence.**

![Aesthetic Archive visual reference wall](./public/marketing/hero-editorial.png)

## Product Entry

- **Product website:** production URL is not published yet. This README will be updated when the deployment domain is confirmed.
- **GitHub repository:** [github.com/Young4ever33/Aesthetic-Archive](https://github.com/Young4ever33/Aesthetic-Archive)
- **Local marketing page:** `http://localhost:5174/`
- **Local workspace:** `http://localhost:5174/app`
- **Local public plaza:** `http://localhost:5174/app?tab=plaza`
- **Local personal archive:** `http://localhost:5174/app?tab=archive`

Aesthetic Archive is currently an Open Beta / MVP foundation. The local product can be explored today; a public production URL will be added after Supabase, Provider, authentication, and deployment validation are complete.

## Product Introduction

Designers do not lack images. They lack a reliable way to remember why a reference matters, explain what makes it work, and reuse that knowledge in the next project.

Aesthetic Archive treats a reference as more than an image. It turns a visual reference into a structured aesthetic card with design elements, cultural context, materials, lighting, geometry, typography, palette, composition, use cases, bilingual prompts, negative prompts, source, and rights information.

The product connects four stages that are usually separated:

```text
Reference → Understanding → Aesthetic System → Production Direction
```

The result is not another image folder or a generic AI image generator. It is a working knowledge layer between inspiration and design production.

## For Whom

Aesthetic Archive is designed for people who need to build, explain, and reuse visual direction:

- **Spatial and landscape designers:** early research, material studies, spatial references, client presentations, and visual direction.
- **Graphic and brand designers:** visual systems, editorial references, typography, composition, color relationships, and brand moodboards.
- **AI visual creators:** repeatable style variables, bilingual prompts, negative constraints, and reference sets.
- **Design students and emerging designers:** style breakdown, visual research, and long-term personal taste development.
- **Small studios and creative teams:** a shared visual language with private project research kept separate from public inspiration.

![Aesthetic Archive for design research](./public/marketing/who.png)

## Use Cases

### Before a project starts

Collect references from different sources and turn a vague direction such as “quiet, tactile, and architectural” into a vocabulary of materials, light, composition, color, and spatial relationships.

### During visual research

Use the Public Plaza to discover reviewed cases, search by aesthetic attributes, save useful references, and compare examples instead of browsing an unstructured image stream.

### During AI-assisted exploration

Upload a reference, ask the system to analyze what is visible, edit the resulting card, and reuse the generated bilingual Prompt as a starting point for visual exploration.

### During presentation and collaboration

Arrange references on a Collage Board, add notes and project intent, summarize the visual direction, and export a clearer brief for clients or teammates.

### After a project

Keep the reasoning behind successful references in a personal archive so the next project starts with accumulated knowledge rather than a blank folder.

## Product Features

### Public Plaza

A moderated public library of aesthetic cases. Browse and search by style, color, composition, scene, use case, and prompt. Open a case, inspect its structured analysis, copy its prompts, save it, or add it to a Collage Board.

### Personal Generation and My Archive

Upload a reference or create a card manually in a private archive. Connect an AI Provider through the server-side gateway, generate an analysis, edit the result, and decide whether the card stays private or enters the review workflow.

![Reference collection and material analysis](./public/marketing/how-reference.png)

### Prompt Reuse

Each analyzed card can produce Chinese and English prompts, negative prompts, and reusable style variables. The goal is to move from “write a new prompt every time” to a Prompt Pack that can be adapted across projects and tools.

![A structured aesthetic card and visual direction](./public/marketing/how-card.png)

### Collage Board

Arrange references into a visual board, add notes, define a direction, and summarize the relationships between images. The board is designed to turn a moodboard into a project-ready visual argument.

![A design collage and project board](./public/marketing/how-editorial.png)

### Saved Cases and Templates

Save public references for later, attach project context, and reuse analysis templates. Templates can be tuned to a discipline, studio method, or personal way of describing visual decisions.

### Review Queue

AI generation does not automatically make a case public. Admin and reviewer roles inspect submissions, approve or reject them, and preserve an audit trail before a card appears in the Public Plaza.

## How Generation Works

1. **Choose a reference.** Upload an image, import a project reference, or create a card manually.
2. **Choose an analysis template.** Select the level of detail and the design vocabulary you need.
3. **Generate with a configured Provider.** The authenticated server sends the request through the AI Gateway. Provider keys stay server-side.
4. **Review the result.** Check visible facts, cultural context, inferences, materials, palette, composition, and confidence. Edit anything that needs correction.
5. **Reuse the output.** Copy the Chinese or English Prompt, adjust the Negative Prompt, add the card to a board, or save it to your archive.
6. **Publish only when ready.** Private cards remain private. Public submissions go through reviewer/admin approval before appearing in the Plaza.

The generation loop is:

```text
Collect → Analyze → Edit → Generate Prompt → Arrange → Reuse or Share
```

![A reference-to-direction workflow](./public/marketing/how-editorial.png)

## Long-Term Value

Aesthetic Archive is designed to create compounding value rather than only produce one-off AI outputs.

- **For individuals:** every structured reference makes personal taste more searchable and easier to explain.
- **For projects:** visual direction becomes a reusable asset instead of disappearing after a presentation.
- **For teams:** shared templates and reviewed cards create a consistent design vocabulary.
- **For the design community:** high-signal public cases can form a more useful aesthetic knowledge layer than an unstructured image feed.
- **For future products:** the archive can support design education, collaboration, research, and more disciplined AI-assisted creation.

The long-term product loop is:

**Collect references → build aesthetic knowledge → reuse in production → contribute better cases → strengthen the knowledge base.**

![Aesthetic research as an ongoing practice](./public/marketing/why-editorial.png)

## Product Principles

- A reference is evidence, not decoration. Visible facts must be separated from interpretation and uncertainty.
- AI assists judgment; it does not replace authorship. Designers control the template, edit the card, and decide what is reusable.
- Private by default. Project research and Provider configuration remain protected unless explicitly shared.
- Explainability over impressive output. A useful card should tell a designer what to notice and how to act on it.
- Source and rights matter. Public cases need source and rights information, and uncertain claims should remain marked as uncertain.
- Aesthetic knowledge should compound. Every structured reference should make the next project faster and more intentional.

## Current Stage

The current Beta foundation includes:

- a marketing page explaining the product story and workflow;
- Public Plaza, My Archive, Saved, Collage, Provider, Settings, and Review Queue surfaces;
- local browser drafts when Supabase is not configured;
- Supabase Auth, Postgres, Storage, RLS, server-side APIs, Provider encryption, AI Gateway routes, and moderation foundations;
- bilingual Chinese and English interface support.

Production readiness still requires real Supabase credentials, deployed migrations, authenticated smoke tests, Provider validation, image-rights verification, and deployment configuration. See `docs/RELEASE_CHECKLIST.md` before treating the project as production-ready.

## Run Locally

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Before opening a pull request:

```bash
pnpm check
```

This runs lint, type checking, repository safety checks, and the production build.

## Technical Foundation

- `app/`: Next.js pages, server APIs, authentication callback, and marketing styles.
- `lib/`: Supabase clients, validation, Provider vault, AI Gateway, and usage logging.
- `public/local-mvp/`: browser workspace UI and public seed dataset.
- `public/marketing/` and `public/brand/`: product assets and workflow visuals used by the application.
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
