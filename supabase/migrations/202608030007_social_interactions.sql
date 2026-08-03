create table if not exists public.authors (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  avatar_url text,
  identity_label text not null default 'Creator',
  bio text,
  design_focus text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint authors_display_name_length check (char_length(display_name) between 1 and 120),
  constraint authors_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$')
);

alter table public.authors enable row level security;

insert into public.authors (slug, display_name, identity_label, is_system)
values ('system-author-yy', '系统作者yy', '系统策展', true)
on conflict (slug) do update set
  display_name = excluded.display_name,
  identity_label = excluded.identity_label,
  is_system = true,
  updated_at = now();

insert into public.authors (profile_id, slug, display_name, avatar_url, identity_label)
select p.id, 'member-' || replace(p.id::text, '-', ''), coalesce(nullif(trim(p.display_name), ''), 'Aesthetic Archive Member'), p.avatar_url,
  case p.role when 'admin' then '管理员' when 'reviewer' then '审核员' else '创作者' end
from public.profiles p
on conflict (profile_id) do nothing;

create or replace function public.sync_profile_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.authors (profile_id, slug, display_name, avatar_url, identity_label)
  values (
    new.id,
    'member-' || replace(new.id::text, '-', ''),
    coalesce(nullif(trim(new.display_name), ''), 'Aesthetic Archive Member'),
    new.avatar_url,
    case new.role when 'admin' then '管理员' when 'reviewer' then '审核员' else '创作者' end
  )
  on conflict (profile_id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    identity_label = excluded.identity_label,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists sync_profile_author_trigger on public.profiles;
create trigger sync_profile_author_trigger
after insert or update of display_name, avatar_url, role on public.profiles
for each row execute function public.sync_profile_author();

alter table public.aesthetic_cards add column if not exists author_id uuid references public.authors(id) on delete restrict;

update public.aesthetic_cards c
set author_id = a.id
from public.authors a
where a.profile_id = c.owner_id and c.author_id is null;

create index if not exists aesthetic_cards_author_public_idx
  on public.aesthetic_cards(author_id, updated_at desc)
  where visibility = 'public' and publish_status = 'published';

create table if not exists public.system_cards (
  card_key text primary key,
  author_id uuid not null references public.authors(id) on delete restrict,
  title text not null,
  title_zh text,
  category text not null,
  created_at timestamptz not null default now(),
  constraint system_cards_key_format check (card_key ~ '^[A-Z]-[0-9]{2}$')
);

insert into public.system_cards (card_key, author_id, title, title_zh, category)
select seed.card_key, author.id, seed.title, seed.title_zh, seed.category
from (values
  ('A-01','Brutalist Architecture and Raw Interior','粗野主义建筑·裸露派室内','Architecture'),
  ('A-02','Minimal Architecture and Quiet Luxury','极简主义建筑·静奢空间','Architecture'),
  ('A-03','Wabi-Sabi Interior and Organic Materiality','侘寂室内·有机材料主义','Architecture'),
  ('A-04','Parametric and Algorithmic Space','参数化·算法生成空间','Architecture'),
  ('A-06','Neo Art Deco and Luxury Geometry','新装饰艺术·奢华几何','Architecture'),
  ('A-07','Dark Romantic and Neo-Gothic Interior','暗黑浪漫·新哥特室内','Architecture'),
  ('A-08','Biophilic and Nature-Integrated Space','生物亲和·自然融合','Architecture'),
  ('A-09','Zen Landscape and Karesansui','禅意景观·枯山水','Architecture'),
  ('A-10','Poetic Tectonics','斯卡帕·诗意建构','Architecture'),
  ('G-01','Neo-Brutalism','新粗野主义','Graphic'),
  ('G-02','Academic Archive and Editorial Minimalism','学术档案风·极简编辑','Graphic'),
  ('G-03','Retro Digital Terminal Aesthetic','复古数字·终端机美学','Graphic'),
  ('G-04','Y2K Retro-Futurism','千禧复古未来主义','Graphic'),
  ('G-05','Utilitarian Industrial System Design','实用工业·系统设计','Graphic'),
  ('G-06','Dark Cinematic Ethereal Aesthetic','暗黑电影·幽玄美学','Graphic'),
  ('G-07','Wabi-Sabi Organic Naturalism','侘寂·有机自然主义','Graphic'),
  ('G-08','Quiet Luxury','静奢·无声权贵','Graphic'),
  ('G-09','Neo Art Deco Maximalism','新装饰艺术·感官极繁','Graphic'),
  ('G-10','Generative Art and Data Poetics','生成艺术·数据诗学','Graphic'),
  ('G-11','Artisanal Craft and New Folk','手工温情·新工艺美术','Graphic'),
  ('G-12','Architectural Art Illustration','建筑艺术插画','Graphic'),
  ('G-13','Cinematic Editorial','电影感编辑排版','Graphic')
) as seed(card_key, title, title_zh, category)
cross join lateral (select id from public.authors where slug = 'system-author-yy') author
on conflict (card_key) do update set title = excluded.title, title_zh = excluded.title_zh, category = excluded.category;

create table if not exists public.card_likes (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.aesthetic_cards(id) on delete cascade,
  system_card_key text references public.system_cards(card_key) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references public.authors(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint card_likes_one_target check ((card_id is not null)::int + (system_card_key is not null)::int = 1)
);

create unique index if not exists card_likes_user_card_unique on public.card_likes(user_id, card_id) where card_id is not null;
create unique index if not exists card_likes_user_system_unique on public.card_likes(user_id, system_card_key) where system_card_key is not null;
create index if not exists card_likes_author_created_idx on public.card_likes(author_id, created_at desc);
create index if not exists card_likes_card_created_idx on public.card_likes(card_id, created_at desc) where card_id is not null;
create index if not exists card_likes_system_created_idx on public.card_likes(system_card_key, created_at desc) where system_card_key is not null;

create table if not exists public.author_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references public.authors(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, author_id)
);

create index if not exists author_follows_author_created_idx on public.author_follows(author_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  card_id uuid references public.aesthetic_cards(id) on delete cascade,
  system_card_key text references public.system_cards(card_key) on delete cascade,
  author_id uuid references public.authors(id) on delete cascade,
  like_id uuid unique references public.card_likes(id) on delete cascade,
  follow_id uuid unique references public.author_follows(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (type in ('card_liked','author_followed','card_approved','card_rejected','card_published','card_unpublished'))
);

create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_recipient_unread_idx on public.notifications(recipient_id, created_at desc) where read_at is null;

alter table public.system_cards enable row level security;
alter table public.card_likes enable row level security;
alter table public.author_follows enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "authors public select" on public.authors;
create policy "authors public select" on public.authors for select using (true);
drop policy if exists "authors update own" on public.authors;
create policy "authors update own" on public.authors for update using (profile_id = auth.uid() and not is_system) with check (profile_id = auth.uid() and not is_system);
revoke all on table public.authors from anon, authenticated;
grant select (id, public_id, slug, display_name, avatar_url, identity_label, bio, design_focus, is_system, created_at, updated_at) on public.authors to anon, authenticated;
grant update (display_name, avatar_url, bio, design_focus, updated_at) on public.authors to authenticated;

drop policy if exists "system cards public select" on public.system_cards;
create policy "system cards public select" on public.system_cards for select using (true);

drop policy if exists "likes select own" on public.card_likes;
create policy "likes select own" on public.card_likes for select using (user_id = auth.uid());
drop policy if exists "follows select own" on public.author_follows;
create policy "follows select own" on public.author_follows for select using (follower_id = auth.uid());
drop policy if exists "notifications select own" on public.notifications;
create policy "notifications select own" on public.notifications for select using (recipient_id = auth.uid());
drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
revoke insert, delete, update on table public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.toggle_card_like(target_key text, should_like boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  target_card public.aesthetic_cards%rowtype;
  target_system public.system_cards%rowtype;
  target_author public.authors%rowtype;
  like_row public.card_likes%rowtype;
  current_count bigint;
  is_uuid boolean := target_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if viewer is null then raise exception 'UNAUTHENTICATED'; end if;
  if is_uuid then
    select * into target_card from public.aesthetic_cards where id = target_key::uuid;
    if target_card.id is null or target_card.visibility <> 'public' or target_card.publish_status <> 'published' then raise exception 'CARD_NOT_PUBLIC'; end if;
    if target_card.owner_id = viewer then raise exception 'OWN_CARD_LIKE_FORBIDDEN'; end if;
    select * into target_author from public.authors where id = target_card.author_id;
  else
    select * into target_system from public.system_cards where card_key = target_key;
    if target_system.card_key is null then raise exception 'CARD_NOT_FOUND'; end if;
    select * into target_author from public.authors where id = target_system.author_id;
  end if;
  if target_author.id is null then raise exception 'AUTHOR_NOT_FOUND'; end if;

  if should_like then
    if is_uuid then
      insert into public.card_likes(card_id, user_id, author_id) values(target_card.id, viewer, target_author.id)
      on conflict (user_id, card_id) where card_id is not null do nothing returning * into like_row;
    else
      insert into public.card_likes(system_card_key, user_id, author_id) values(target_system.card_key, viewer, target_author.id)
      on conflict (user_id, system_card_key) where system_card_key is not null do nothing returning * into like_row;
    end if;
    if like_row.id is not null and target_author.profile_id is not null and target_author.profile_id <> viewer then
      insert into public.notifications(recipient_id, actor_id, type, card_id, system_card_key, author_id, like_id, payload)
      values(target_author.profile_id, viewer, 'card_liked', target_card.id, target_system.card_key, target_author.id, like_row.id,
        jsonb_build_object('cardTitle', coalesce(target_card.title_zh, target_card.title, target_system.title_zh, target_system.title)));
    end if;
  else
    if is_uuid then delete from public.card_likes where card_id = target_card.id and user_id = viewer;
    else delete from public.card_likes where system_card_key = target_system.card_key and user_id = viewer;
    end if;
  end if;

  if is_uuid then select count(*) into current_count from public.card_likes where card_id = target_card.id;
  else select count(*) into current_count from public.card_likes where system_card_key = target_system.card_key;
  end if;
  return jsonb_build_object('liked', should_like and exists(select 1 from public.card_likes where user_id = viewer and ((is_uuid and card_id = target_card.id) or (not is_uuid and system_card_key = target_system.card_key))), 'likeCount', current_count);
end;
$$;

create or replace function public.toggle_author_follow(target_public_id uuid, should_follow boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  target_author public.authors%rowtype;
  follow_row public.author_follows%rowtype;
  current_count bigint;
begin
  if viewer is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into target_author from public.authors where public_id = target_public_id;
  if target_author.id is null then raise exception 'AUTHOR_NOT_FOUND'; end if;
  if target_author.profile_id = viewer then raise exception 'SELF_FOLLOW_FORBIDDEN'; end if;
  if should_follow then
    insert into public.author_follows(follower_id, author_id) values(viewer, target_author.id)
    on conflict (follower_id, author_id) do nothing returning * into follow_row;
    if follow_row.id is not null and target_author.profile_id is not null then
      insert into public.notifications(recipient_id, actor_id, type, author_id, follow_id, payload)
      values(target_author.profile_id, viewer, 'author_followed', target_author.id, follow_row.id, jsonb_build_object('authorName', target_author.display_name));
    end if;
  else
    delete from public.author_follows where follower_id = viewer and author_id = target_author.id;
  end if;
  select count(*) into current_count from public.author_follows where author_id = target_author.id;
  return jsonb_build_object('following', should_follow and exists(select 1 from public.author_follows where follower_id = viewer and author_id = target_author.id), 'followerCount', current_count);
end;
$$;

revoke all on function public.toggle_card_like(text, boolean) from public;
grant execute on function public.toggle_card_like(text, boolean) to authenticated;
revoke all on function public.toggle_author_follow(uuid, boolean) from public;
grant execute on function public.toggle_author_follow(uuid, boolean) to authenticated;
