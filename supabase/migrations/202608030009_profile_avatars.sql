insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile avatars public read" on storage.objects;
create policy "profile avatars public read" on storage.objects
for select using (bucket_id = 'profile-avatars');

drop policy if exists "profile avatars owner insert" on storage.objects;
create policy "profile avatars owner insert" on storage.objects
for insert with check (bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "profile avatars owner update" on storage.objects;
create policy "profile avatars owner update" on storage.objects
for update using (bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "profile avatars owner delete" on storage.objects;
create policy "profile avatars owner delete" on storage.objects
for delete using (bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1]);
