alter table public.user_feedback alter column owner_id drop not null;

drop policy if exists "feedback own insert" on public.user_feedback;
create policy "feedback own insert" on public.user_feedback
  for insert
  with check (owner_id = auth.uid() or owner_id is null);
