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
