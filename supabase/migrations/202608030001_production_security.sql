-- Production security baseline for Aesthetic Archive.
-- Apply after the existing schema migrations. This migration does not expose Provider secrets.

create extension if not exists pgcrypto;

alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'reviewer', 'admin'));

alter table public.aesthetic_cards
  add constraint aesthetic_cards_visibility_check check (visibility in ('private', 'public')),
  add constraint aesthetic_cards_publish_status_check check (publish_status in ('private', 'pending', 'approved', 'rejected', 'published', 'unpublished'));

alter table public.ai_providers
  add constraint ai_providers_owner_required check (owner_id is not null);

-- The encrypted secret is for trusted server-side use only. Client roles cannot select it.
revoke select (encrypted_api_key) on public.ai_providers from anon, authenticated;

-- Replace broad policies that would allow a normal client to mutate moderation fields.
drop policy if exists "cards update own or admin" on public.aesthetic_cards;
create policy "cards update own content" on public.aesthetic_cards
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (
      owner_id = auth.uid()
      and publish_status in ('private', 'pending', 'rejected', 'unpublished')
    )
  );

-- Only the owner can submit a review. Admin review mutations happen in a privileged server route.
drop policy if exists "reviews update admin" on public.publish_reviews;
create policy "reviews update admin" on public.publish_reviews
  for update using (public.is_admin())
  with check (public.is_admin());

-- Prevent ordinary users from creating usage records for another user.
drop policy if exists "usage logs insert own" on public.ai_usage_logs;
create policy "usage logs insert own" on public.ai_usage_logs
  for insert with check (owner_id = auth.uid());

-- Storage bucket for user card images. Actual object access remains governed by storage policies.
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', false)
on conflict (id) do nothing;

create policy "card images objects select own" on storage.objects
  for select to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "card images objects insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "card images objects update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "card images objects delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
