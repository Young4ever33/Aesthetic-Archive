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
