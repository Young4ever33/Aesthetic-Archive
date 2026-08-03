-- Reconcile security-sensitive objects that may have drifted from the migration history.
-- This migration is idempotent and does not modify business rows or stored objects.

-- A table-level SELECT grant overrides a column-level revoke. Remove broad client
-- reads, then grant authenticated users only the non-secret Provider columns used
-- by the server API. The service_role retains its existing privileges.
revoke select on table public.ai_providers from anon, authenticated;
grant select (
  id,
  owner_id,
  name,
  type,
  base_url,
  image_capable,
  image_models,
  text_models,
  default_image_model,
  default_text_model,
  image_api,
  image_api_url,
  is_default,
  created_at,
  updated_at
) on table public.ai_providers to authenticated;

-- Keep reviewer mutations constrained on both the existing and resulting row.
drop policy if exists "reviews update admin" on public.publish_reviews;
create policy "reviews update admin" on public.publish_reviews
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- Consolidate historical Storage policies into one owner-scoped policy per action.
drop policy if exists "card images public read" on storage.objects;
drop policy if exists "card images owner insert" on storage.objects;
drop policy if exists "card images owner update" on storage.objects;
drop policy if exists "card images owner delete" on storage.objects;
drop policy if exists "card images objects select own" on storage.objects;
drop policy if exists "card images objects insert own" on storage.objects;
drop policy if exists "card images objects update own" on storage.objects;
drop policy if exists "card images objects delete own" on storage.objects;
drop policy if exists "card images objects select own final" on storage.objects;

create policy "card images objects select own final" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "card images objects insert own final" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "card images objects update own final" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "card images objects delete own final" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
