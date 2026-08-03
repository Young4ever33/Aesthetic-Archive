# Next.js / Supabase Migration Plan

Goal: migrate the closed local MVP into a real web beta with accounts, cloud persistence, and backend AI Provider proxy.

## Target Stack

- App: Next.js + React + TypeScript
- UI: Tailwind CSS + Radix UI or shadcn/ui
- Auth: Supabase Auth
- Database: Supabase Postgres
- Storage: Supabase Storage or Cloudflare R2
- Backend: Next.js Route Handlers
- Canvas: Konva.js or Fabric.js
- Observability: Sentry later, console/server logs first

## Migration Principle

Do not keep adding production complexity to the single-file MVP. Treat the current MVP as a feature specification and interaction prototype.

The first cloud beta should reproduce the MVP flows, not add major new product features.

## App Routes

```text
/                         Marketing page
/app                      Authenticated app shell
/app/plaza                Public Plaza
/app/archive              My Archive
/app/saved                Saved
/app/boards               Board list
/app/boards/[id]          Collage Board
/app/providers            AI Provider manager
/app/settings             User settings
/admin/reviews            Review queue, admin only
```

## Database Schema Draft

### profiles

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  language text default 'zh-CN',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### aesthetic_cards

```sql
create table aesthetic_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  source text not null default 'private',
  title text not null,
  title_zh text,
  category text default 'Other',
  visibility text not null default 'private',
  publish_status text not null default 'private',
  summary text,
  cultural_background text,
  design_elements text,
  palette jsonb default '[]'::jsonb,
  style_tags jsonb default '[]'::jsonb,
  material_tags jsonb default '[]'::jsonb,
  space_tags jsonb default '[]'::jsonb,
  scenario_tags jsonb default '[]'::jsonb,
  composition text,
  use_cases text,
  prompt_zh text,
  prompt_en text,
  negative_prompt text,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### card_images

```sql
create table card_images (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references aesthetic_cards(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  url text not null,
  storage_path text,
  alt text,
  sort_order int default 0,
  width int,
  height int,
  mime_type text,
  created_at timestamptz default now()
);
```

### saved_cards

```sql
create table saved_cards (
  user_id uuid references auth.users(id) on delete cascade,
  card_id uuid references aesthetic_cards(id) on delete cascade,
  saved_at timestamptz default now(),
  primary key (user_id, card_id)
);
```

### ai_providers

```sql
create table ai_providers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  encrypted_api_key text not null,
  base_url text,
  image_capable boolean default true,
  image_models jsonb default '[]'::jsonb,
  text_models jsonb default '[]'::jsonb,
  default_image_model text,
  default_text_model text,
  image_api text default 'none',
  image_api_url text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### boards

```sql
create table boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null default 'Untitled Board',
  summary text,
  visibility text not null default 'private',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### board_nodes

```sql
create table board_nodes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  ref_card_id uuid references aesthetic_cards(id) on delete set null,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  x numeric default 0,
  y numeric default 0,
  w numeric default 120,
  h numeric default 80,
  rotation numeric default 0,
  z int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### board_strokes

```sql
create table board_strokes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  points jsonb not null,
  color text default '#111111',
  size numeric default 3,
  z int default 1,
  created_at timestamptz default now()
);
```

### publish_reviews

```sql
create table publish_reviews (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references aesthetic_cards(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending',
  reviewer_id uuid references auth.users(id) on delete set null,
  note text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz
);
```

### ai_usage_logs

```sql
create table ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  provider_id uuid references ai_providers(id) on delete set null,
  route text not null,
  model text,
  status text not null,
  error text,
  created_at timestamptz default now()
);
```

## RLS Policy Outline

- Users can read/update/delete their own private cards.
- Anyone can read cards where `visibility = 'public' and publish_status = 'published'`.
- Users can read their own pending/rejected cards.
- Admins can read pending reviews.
- Users can only read/write their own providers.
- Users can only read/write their own boards and board nodes.
- Users can only read/write their own saved cards.

## API Routes

```text
POST /api/ai/analyze-image
POST /api/ai/board-summary
POST /api/image/remove-background
POST /api/image/extract-palette
POST /api/cards/[id]/submit-review
POST /api/admin/reviews/[id]/approve
POST /api/admin/reviews/[id]/reject
```

## AI Proxy Requirements

- API keys are never sent to the browser after saving.
- API keys are encrypted at rest.
- Server route resolves provider by `providerId` and authenticated user.
- Normalize errors into user-readable messages.
- Timeout all provider requests.
- Log route, provider, model, success/failure.
- For image processing, upload results to storage and return a storage URL.

## Implementation Order

### Step 1: Create Next.js App

- Initialize app.
- Add TypeScript.
- Add Tailwind.
- Add base layout.
- Port marketing page.
- Port app shell.

### Step 2: Supabase Setup

- Create Supabase project.
- Add schema migrations.
- Add RLS policies.
- Add generated database types.
- Add auth helpers.

### Step 3: Auth and Profiles

- Email login.
- Google login.
- Profile row creation.
- Protected `/app` routes.

### Step 4: Cards and Images

- Port Public Plaza from seed data first.
- Add card CRUD for My Archive.
- Add image upload to storage.
- Add saved cards.
- Add publish status.

### Step 5: Provider Vault and AI Proxy

- Provider CRUD.
- Encrypt API keys.
- Add image-capable model selection.
- Add `/api/ai/analyze-image`.
- Add `/api/ai/board-summary`.
- Add `/api/image/remove-background`.

### Step 6: Collage Board

- Use Konva.js/Fabric.js.
- Port nodes and strokes.
- Add text, sticky, pen, image nodes.
- Add undo/redo.
- Add export JSON.
- Add export PNG.

### Step 7: Review Admin

- Submit for review.
- Pending queue.
- Approve/reject/unpublish.
- Public Plaza only shows published cards.

### Step 8: Migration Import

- Import localStorage JSON exports.
- Import private cards.
- Import providers without API keys unless user re-enters key.
- Import boards.

## Beta Acceptance Criteria

- User can sign up and sign in.
- User can create a private aesthetic card with uploaded images.
- User can analyze an uploaded image through backend AI proxy.
- User can configure multiple Providers without exposing API keys to browser.
- User can save cards to cloud database.
- User can create and reopen a board from another browser session.
- User can generate Board AI Summary through backend proxy.
- User can call Remove BG through backend route and store the processed result.
- User can submit card for review.
- Admin can approve card.
- Published card appears in Public Plaza.
- User can export their data.

## Not In First Cloud Beta

- Billing.
- Team workspaces.
- Marketplace.
- Realtime multiplayer board editing.
- Hosted platform AI credits for all users.
- Advanced moderation AI.
- Native mobile app.
