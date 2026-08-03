insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  create policy "card images public read" on storage.objects
    for select using (bucket_id = 'card-images');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "card images owner insert" on storage.objects
    for insert with check (bucket_id = 'card-images' and auth.uid()::text = (storage.foldername(name))[1]);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "card images owner update" on storage.objects
    for update using (bucket_id = 'card-images' and auth.uid()::text = (storage.foldername(name))[1]);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "card images owner delete" on storage.objects
    for delete using (bucket_id = 'card-images' and auth.uid()::text = (storage.foldername(name))[1]);
exception when duplicate_object then null;
end $$;
