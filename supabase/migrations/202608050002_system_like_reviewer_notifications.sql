-- One system-card Like can notify each reviewer/admin account.
-- Keep one notification per recipient and Like while preserving cascade cleanup on Unlike.
alter table public.notifications drop constraint if exists notifications_like_id_key;
drop index if exists public.notifications_like_id_key;
create unique index if not exists notifications_recipient_like_unique
  on public.notifications(recipient_id, like_id)
  where like_id is not null;
