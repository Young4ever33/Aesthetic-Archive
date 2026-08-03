# Aesthetic Archive MVP Release Notes

Release: Local Frontend MVP
Date: 2026-07-30
Status: Ready for manual QA and architecture migration

## Product Scope

Aesthetic Archive is currently a local browser MVP for designers to turn aesthetic references into searchable, explainable, reusable design production material.

The MVP includes:

- Marketing page with the positioning: `别再只是收藏参考图，开始搭建你的审美知识库。`
- Full app shell entered through view switching, not by scrolling into the app.
- Public Plaza for browsing, searching, filtering, exporting, saving, copying, and opening public aesthetic cases.
- My Archive for creating, editing, uploading, analyzing, saving, publishing, and exporting private aesthetic cards.
- Saved view for local saved cases.
- Collage Board free canvas for creative composition, image placement, notes, sticky notes, text, drawing, image tools, summary, and export.
- AI Provider manager for multiple user-owned providers and image-capable model selection.
- Local login demo for front-end validation.
- LocalStorage persistence for all MVP user data.

## Implemented Areas

### Public Plaza

- Search and category filtering.
- Quick query chips.
- Card grid using `window.AA_CASES` seed data.
- Public user-published private cards appear only after approval.
- Empty state.
- Export current filtered results as Markdown or JSON.
- Save cards locally.
- Copy public case to My Archive.
- Add card to Collage Board.
- Detail panel with gallery, knowledge fields, prompt blocks, and actions.

### My Archive

- Manual aesthetic card creation.
- Edit existing private cards.
- Copy public cases into private archive.
- Multi-image upload with compression.
- Local image preview.
- Local deterministic AI draft generation.
- Real browser-side AI Provider image analysis hook.
- Provider fallback to local draft on failure.
- Visibility and publication review status:
  - private
  - pending
  - published
  - rejected
- Local approval / rejection / unpublish controls.
- Storage health panel.
- Optimize Images.
- Remove Images.
- Export Markdown / JSON.
- Delete individual private card.
- Clear private archive.

### AI Provider

- Multiple Provider cards stored locally.
- Legacy single-provider config migration.
- Provider fields:
  - name
  - type
  - API key
  - base URL
  - image-capable models
  - text models
  - image processing API
  - image processing endpoint
  - image-capable flag
- Supported provider types:
  - OpenAI
  - Gemini
  - OpenRouter
  - Custom Endpoint
- Provider list actions:
  - edit
  - default
  - delete
- My Archive model selector:
  - Provider select
  - Image Model select
  - Local fallback option
- Browser-side Provider calls:
  - OpenAI-compatible vision
  - Gemini vision
  - OpenAI-compatible text
  - Gemini text

### Collage Board

- Free canvas instead of static grid.
- Add image nodes from Plaza / Archive / Detail.
- Move, resize, duplicate, bring front, send back, remove.
- Undo / redo with history.
- Delete / Backspace shortcut for selected element.
- Escape clears selection.
- Right-side vertical tool rail:
  - select
  - text
  - sticky
  - pen
  - undo
  - redo
  - clear last stroke
- Text node:
  - transparent background
  - editable text
  - move handle
  - resize handle
  - text color
  - font weight
- Sticky node:
  - editable text
  - move handle
  - resize handle
  - background color
  - text color
  - font weight
- Pen:
  - draw over canvas and images
  - accurate pointer coordinates
  - color control
  - size control
  - clear last stroke
- Image Inspector:
  - replace image URL
  - remove background hook
  - extract palette
  - show extracted palette
- Board AI Summary:
  - calls configured text Provider when available
  - falls back to local summary
  - saves generated summary to board data
- Export:
  - Markdown
  - JSON

### Detail Panel

- Left Style Gallery and right aesthetic knowledge layout.
- Prompt ZH and Prompt EN appear at top of the detail content.
- Prompt ZH uses orange styling.
- Prompt EN uses blue styling.
- Gallery images preserve original proportions with `object-fit: contain`.
- Detail actions are sticky.
- Private/public-aware copy/edit action.

### Language and Auth

- Chinese / English language dropdown.
- Local language persistence.
- Local demo login:
  - Email / phone identity
  - Google demo login
  - logout
- No real backend authentication yet.

## LocalStorage Keys

```js
const STORAGE = {
  saved: 'aa_saved_cases_v2',
  provider: 'aa_ai_provider_settings',
  providers: 'aa_ai_providers_v1',
  privateCases: 'aa_private_cases_v1',
  collage: 'aa_collage_board_v1',
  language: 'aa_language',
  user: 'aa_demo_user'
};
```

## Known Limitations

- Data is stored in localStorage and can be lost if the browser clears site data.
- Uploaded images are base64 data URLs stored locally and can hit browser quota.
- Browser-side AI Provider calls may fail because of CORS, provider policy, model permission, or invalid keys.
- Browser-side API keys are exposed to the page and are not production-safe.
- Remove Background API calls are browser-side hooks and may require a backend proxy.
- Extract Palette can fail on remote images blocked by canvas CORS.
- The current Collage Board uses DOM elements, not a production canvas engine such as Konva/Fabric.
- No real multi-user auth, database, cloud storage, review backend, billing, analytics, or moderation backend exists yet.
- Browser automation tests are not present in the project.

## Migration Priority

The MVP is ready to migrate into a production architecture:

1. Next.js / React / TypeScript app shell.
2. Supabase Auth for real accounts.
3. Supabase Postgres schema for cards, boards, providers, reviews, and saved items.
4. Supabase Storage or Cloudflare R2 for images.
5. Backend AI Provider proxy for vision, text, board summary, and image processing.
6. Konva.js or Fabric.js for production Collage Board.

## Release Gate

The MVP is considered closed when the QA checklist in `docs/MVP_QA_CHECKLIST.md` is manually walked through and no blocker remains for the architecture migration.
