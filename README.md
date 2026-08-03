# Aesthetic Archive

[中文 README](./README.zh-CN.md)

**Product Website:** [https://your-domain.com](https://your-domain.com) *(deployment URL placeholder)*

> **Aesthetic Archive is an AI-powered aesthetic knowledge base for everyone who cares about aesthetics and design. It turns scattered visual references into a searchable, traceable, decomposable, and reusable system of design and aesthetic intelligence.**

![Aesthetic Archive visual reference wall](./public/marketing/hero-editorial.png)

## Product Introduction

Anyone who cares about aesthetics can accumulate more images than they can meaningfully understand. What is missing is a reliable way to remember why a reference matters, trace where it came from, break down what makes it work, and reuse that knowledge in the next creation, choice, or design project.

Aesthetic Archive treats a reference as more than an image. It turns a visual reference into a structured aesthetic card with design elements, cultural context, materials, lighting, geometry, typography, palette, composition, use cases, bilingual prompts, negative prompts, source, and rights information. Whether the context is professional work or personal taste, a one-off save can become knowledge that remains useful over time.

The product connects four stages that are usually separated:

```text
Reference → Understanding → Aesthetic System → Production Direction
```

The result is not another image folder or a generic AI image generator. It is a working knowledge layer between inspiration and design production.

## For Whom

Aesthetic Archive is for anyone who wants to build, understand, and reuse aesthetic knowledge:

- **Spatial designers across planning, architecture, landscape, and interiors:** early research, material studies, spatial references, client presentations, and visual direction.
- **Graphic, brand, and UI designers:** visual systems, editorial references, typography, interfaces, composition, color relationships, and brand moodboards.
- **Photographers and image-makers:** references for lighting, color grading, visual narrative, lens language, atmosphere, and composition.
- **AI visual creators:** repeatable style variables, bilingual prompts, negative constraints, and reference sets.
- **Personal aesthetic collectors, design students, and emerging creators:** everyday inspiration, style breakdown, visual research, and long-term development of a personal aesthetic system.
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

![Public Plaza product interface](./docs/screenshots/public-plaza.png)

### Personal Generation and My Archive

Upload a reference or create a card manually in a private archive. Connect an AI Provider through the server-side gateway, generate an analysis, edit the result, and decide whether the card stays private or enters the review workflow.

![Personal generation and My Archive interface](./docs/screenshots/my-archive.png)

### Prompt Reuse

Each analyzed card can produce Chinese and English prompts, negative prompts, and reusable style variables. The goal is to move from “write a new prompt every time” to a Prompt Pack that can be adapted across projects and tools. The generation form and editable aesthetic card keep analysis, bilingual prompts, and archive storage in one workflow.

### Collage Board

Arrange references into a visual board, add notes, define a direction, and summarize the relationships between images. The board is designed to turn a moodboard into a project-ready visual argument.

![Collage Board product interface](./docs/screenshots/collage-board.png)

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

## Assets and License

See `LICENSE`. Before commercial launch, confirm that every public seed image is self-owned, licensed for redistribution, or replaced. Do not publish unverified reference images, private browser exports, screenshots, or temporary QA material.
