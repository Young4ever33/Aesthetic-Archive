-- Aesthetic Archive Supabase schema bundle
-- Run this in Supabase SQL Editor before pnpm seed:cases.


-- supabase/migrations/202607300001_initial_schema.sql
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  language text default 'zh-CN',
  role text default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.aesthetic_cards (
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

create table if not exists public.card_images (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.aesthetic_cards(id) on delete cascade,
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

create table if not exists public.saved_cards (
  user_id uuid references auth.users(id) on delete cascade,
  card_id uuid references public.aesthetic_cards(id) on delete cascade,
  saved_at timestamptz default now(),
  primary key (user_id, card_id)
);

create table if not exists public.ai_providers (
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

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null default 'Untitled Board',
  summary text,
  visibility text not null default 'private',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.board_nodes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references public.boards(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  ref_card_id uuid references public.aesthetic_cards(id) on delete set null,
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

create table if not exists public.board_strokes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references public.boards(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  points jsonb not null,
  color text default '#111111',
  size numeric default 3,
  z int default 1,
  created_at timestamptz default now()
);

create table if not exists public.publish_reviews (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.aesthetic_cards(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending',
  reviewer_id uuid references auth.users(id) on delete set null,
  note text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  provider_id uuid references public.ai_providers(id) on delete set null,
  route text not null,
  model text,
  status text not null,
  error text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.aesthetic_cards enable row level security;
alter table public.card_images enable row level security;
alter table public.saved_cards enable row level security;
alter table public.ai_providers enable row level security;
alter table public.boards enable row level security;
alter table public.board_nodes enable row level security;
alter table public.board_strokes enable row level security;
alter table public.publish_reviews enable row level security;
alter table public.ai_usage_logs enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

-- Make the bundle safe to re-run after a partial SQL Editor execution.
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where ((schemaname = 'public' and tablename in ('profiles', 'aesthetic_cards', 'card_images', 'saved_cards', 'ai_providers', 'boards', 'board_nodes', 'board_strokes', 'publish_reviews', 'ai_usage_logs')) or (schemaname = 'storage' and tablename = 'objects')) and policyname in ('profiles select own', 'profiles update own', 'cards select own or published', 'cards insert own', 'cards update own or admin', 'cards update own content', 'cards delete own', 'card images select own or published card', 'card images insert own', 'card images update own', 'card images delete own', 'saved select own', 'saved insert own', 'saved delete own', 'providers own', 'boards own', 'board nodes own', 'board strokes own', 'reviews select own or admin', 'reviews insert own', 'reviews update admin', 'usage logs select own', 'usage logs insert own', 'card images public read', 'card images owner insert', 'card images owner update', 'card images owner delete', 'card images objects select own', 'card images objects insert own', 'card images objects update own', 'card images objects delete own', 'card images objects select own final') loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy "profiles select own" on public.profiles for select using (id = auth.uid());
create policy "profiles update own" on public.profiles for update using (id = auth.uid());

create policy "cards select own or published" on public.aesthetic_cards for select using (
  owner_id = auth.uid() or (visibility = 'public' and publish_status = 'published') or public.is_admin()
);
create policy "cards insert own" on public.aesthetic_cards for insert with check (owner_id = auth.uid());
create policy "cards update own or admin" on public.aesthetic_cards for update using (owner_id = auth.uid() or public.is_admin());
create policy "cards delete own" on public.aesthetic_cards for delete using (owner_id = auth.uid());

create policy "card images select own or published card" on public.card_images for select using (
  owner_id = auth.uid() or exists(select 1 from public.aesthetic_cards c where c.id = card_id and c.visibility = 'public' and c.publish_status = 'published') or public.is_admin()
);
create policy "card images insert own" on public.card_images for insert with check (owner_id = auth.uid());
create policy "card images update own" on public.card_images for update using (owner_id = auth.uid());
create policy "card images delete own" on public.card_images for delete using (owner_id = auth.uid());

create policy "saved select own" on public.saved_cards for select using (user_id = auth.uid());
create policy "saved insert own" on public.saved_cards for insert with check (user_id = auth.uid());
create policy "saved delete own" on public.saved_cards for delete using (user_id = auth.uid());

create policy "providers own" on public.ai_providers for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "boards own" on public.boards for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "board nodes own" on public.board_nodes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "board strokes own" on public.board_strokes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "reviews select own or admin" on public.publish_reviews for select using (owner_id = auth.uid() or public.is_admin());
create policy "reviews insert own" on public.publish_reviews for insert with check (owner_id = auth.uid());
create policy "reviews update admin" on public.publish_reviews for update using (public.is_admin());

create policy "usage logs select own" on public.ai_usage_logs for select using (owner_id = auth.uid());
create policy "usage logs insert own" on public.ai_usage_logs for insert with check (owner_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- supabase/migrations/202607300002_seed_source_columns.sql
alter table public.aesthetic_cards
  add column if not exists source_id text,
  add column if not exists source_slug text,
  add column if not exists design_logic text,
  add column if not exists historical_origin text;

create unique index if not exists aesthetic_cards_source_slug_key
  on public.aesthetic_cards (source, source_slug)
  where source_slug is not null;

create index if not exists aesthetic_cards_public_published_idx
  on public.aesthetic_cards (visibility, publish_status);

create index if not exists card_images_card_sort_idx
  on public.card_images (card_id, sort_order);


-- supabase/migrations/202607300003_storage_card_images.sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  create policy "card images public read" on storage.objects
    for select using (bucket_id = 'card-images');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "card images owner insert" on storage.objects
    for insert with check (bucket_id = 'card-images' and auth.uid()::text = (storage.foldername(name))[1]);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "card images owner update" on storage.objects
    for update using (bucket_id = 'card-images' and auth.uid()::text = (storage.foldername(name))[1]);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "card images owner delete" on storage.objects
    for delete using (bucket_id = 'card-images' and auth.uid()::text = (storage.foldername(name))[1]);
exception when duplicate_object then null;
end $$;


-- supabase/migrations/202607300004_provider_pi_settings.sql
alter table public.ai_providers add column if not exists api_type text;
alter table public.ai_providers add column if not exists compat jsonb default '{}'::jsonb;
alter table public.ai_providers add column if not exists headers jsonb default '{}'::jsonb;

-- supabase/migrations/202608030001_production_security.sql
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'reviewer', 'admin'));
alter table public.aesthetic_cards drop constraint if exists aesthetic_cards_visibility_check;
alter table public.aesthetic_cards add constraint aesthetic_cards_visibility_check check (visibility in ('private', 'public'));
alter table public.aesthetic_cards drop constraint if exists aesthetic_cards_publish_status_check;
alter table public.aesthetic_cards add constraint aesthetic_cards_publish_status_check check (publish_status in ('private', 'pending', 'approved', 'rejected', 'published', 'unpublished'));
alter table public.ai_providers drop constraint if exists ai_providers_owner_required;
alter table public.ai_providers add constraint ai_providers_owner_required check (owner_id is not null);
revoke select (encrypted_api_key) on public.ai_providers from anon, authenticated;
drop policy if exists "cards update own or admin" on public.aesthetic_cards;
drop policy if exists "cards update own content" on public.aesthetic_cards;
create policy "cards update own content" on public.aesthetic_cards for update using (owner_id = auth.uid() or public.is_admin()) with check (public.is_admin() or (owner_id = auth.uid() and publish_status in ('private', 'pending', 'rejected', 'unpublished')));

-- Final private Storage and runtime additions.
update storage.buckets set public = false where id = 'card-images';
drop policy if exists "card images public read" on storage.objects;
alter table public.aesthetic_cards add column if not exists version integer not null default 1;
alter table public.aesthetic_cards add column if not exists rights_status text not null default 'unknown';
alter table public.aesthetic_cards drop constraint if exists aesthetic_cards_rights_status_check;
alter table public.aesthetic_cards add constraint aesthetic_cards_rights_status_check check (rights_status in ('unknown', 'user_owned', 'licensed', 'public_domain', 'fair_use_review', 'restricted'));
create index if not exists aesthetic_cards_owner_updated_idx on public.aesthetic_cards(owner_id, updated_at desc);
create index if not exists aesthetic_cards_public_idx on public.aesthetic_cards(visibility, publish_status, updated_at desc);
create index if not exists publish_reviews_status_idx on public.publish_reviews(status, submitted_at desc);

-- supabase/migrations/202608030003_ai_usage_observability.sql
alter table public.ai_usage_logs add column if not exists request_id text;
alter table public.ai_usage_logs add column if not exists duration_ms integer;
create index if not exists ai_usage_logs_owner_created_idx on public.ai_usage_logs(owner_id, created_at desc);

-- supabase/migrations/202608030004_feedback_reports.sql
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  kind text not null default 'feedback' check (kind in ('feedback', 'report')),
  target_type text check (target_type in ('card', 'board', 'provider', 'app')),
  target_id uuid,
  message text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.user_feedback enable row level security;
drop policy if exists "feedback own select" on public.user_feedback;
drop policy if exists "feedback own insert" on public.user_feedback;
drop policy if exists "feedback admin update" on public.user_feedback;
create policy "feedback own select" on public.user_feedback for select using (owner_id = auth.uid() or public.is_admin());
create policy "feedback own insert" on public.user_feedback for insert with check (owner_id = auth.uid());
create policy "feedback admin update" on public.user_feedback for update using (public.is_admin());
create index if not exists user_feedback_status_created_idx on public.user_feedback(status, created_at desc);

