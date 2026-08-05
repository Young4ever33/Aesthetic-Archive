create table if not exists public.system_messages (
  id uuid primary key default gen_random_uuid(),
  title_zh text not null,
  title_en text not null,
  body_zh text not null,
  body_en text not null,
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.user_feedback(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_role text not null default 'user' check (sender_role in ('user', 'reviewer', 'admin')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.system_messages enable row level security;
alter table public.feedback_messages enable row level security;
create policy "published system messages select" on public.system_messages for select using (published = true or public.is_admin());
create policy "feedback messages own select" on public.feedback_messages for select using (exists (select 1 from public.user_feedback f where f.id = feedback_id and (f.owner_id = auth.uid() or public.is_admin())));
create policy "feedback messages own insert" on public.feedback_messages for insert with check (sender_id = auth.uid() and sender_role = 'user' and exists (select 1 from public.user_feedback f where f.id = feedback_id and f.owner_id = auth.uid()));
create index if not exists system_messages_published_idx on public.system_messages(published, published_at desc);
create index if not exists feedback_messages_thread_idx on public.feedback_messages(feedback_id, created_at asc);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('card_liked','author_followed','card_approved','card_rejected','card_published','card_unpublished','system_message','feedback_reply'));
alter table public.notifications add column if not exists system_message_id uuid references public.system_messages(id) on delete cascade;
alter table public.notifications add column if not exists feedback_id uuid references public.user_feedback(id) on delete cascade;
create index if not exists notifications_system_message_idx on public.notifications(system_message_id) where system_message_id is not null;
create index if not exists notifications_feedback_idx on public.notifications(feedback_id) where feedback_id is not null;

insert into public.feedback_messages (feedback_id, sender_id, sender_role, message)
select id, owner_id, 'user', message from public.user_feedback
where not exists (select 1 from public.feedback_messages m where m.feedback_id = user_feedback.id);

create or replace function public.publish_system_message(message_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.system_messages%rowtype;
  recipient uuid;
  total integer := 0;
begin
  select * into row from public.system_messages where id = message_id;
  if row.id is null then raise exception 'SYSTEM_MESSAGE_NOT_FOUND'; end if;
  update public.system_messages set published = true, published_at = coalesce(published_at, now()) where id = message_id;
  for recipient in select id from public.profiles loop
    insert into public.notifications(recipient_id, type, system_message_id, payload)
    values (recipient, 'system_message', message_id, jsonb_build_object('titleZh', row.title_zh, 'titleEn', row.title_en, 'bodyZh', row.body_zh, 'bodyEn', row.body_en));
    total := total + 1;
  end loop;
  return total;
end;
$$;
revoke all on function public.publish_system_message(uuid) from public;
grant execute on function public.publish_system_message(uuid) to service_role;
