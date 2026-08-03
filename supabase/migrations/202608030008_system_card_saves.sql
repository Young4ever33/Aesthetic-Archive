create table if not exists public.system_saved_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  system_card_key text not null references public.system_cards(card_key) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, system_card_key)
);

alter table public.system_saved_cards enable row level security;

create policy "system saved select own" on public.system_saved_cards
for select using (user_id = auth.uid());

create policy "system saved insert own" on public.system_saved_cards
for insert with check (user_id = auth.uid());

create policy "system saved delete own" on public.system_saved_cards
for delete using (user_id = auth.uid());
