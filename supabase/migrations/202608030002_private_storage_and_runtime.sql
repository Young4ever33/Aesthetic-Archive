-- Finalize private image storage after the original MVP migration.
update storage.buckets set public = false where id = 'card-images';
drop policy if exists "card images public read" on storage.objects;

-- Keep object access scoped to the authenticated owner's first path segment.
do $$ begin
  create policy "card images objects select own final" on storage.objects
    for select to authenticated using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null;
end $$;

alter table public.aesthetic_cards add column if not exists version integer not null default 1;
alter table public.aesthetic_cards add column if not exists rights_status text not null default 'unknown';
alter table public.aesthetic_cards add constraint aesthetic_cards_rights_status_check check (rights_status in ('unknown', 'user_owned', 'licensed', 'public_domain', 'fair_use_review', 'restricted'));
create index if not exists aesthetic_cards_owner_updated_idx on public.aesthetic_cards(owner_id, updated_at desc);
create index if not exists aesthetic_cards_public_idx on public.aesthetic_cards(visibility, publish_status, updated_at desc);
create index if not exists publish_reviews_status_idx on public.publish_reviews(status, submitted_at desc);
