-- Complete authenticated author provisioning and published image access without service-role reads.

create or replace function public.ensure_current_author()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  profile_row public.profiles%rowtype;
  author_row public.authors%rowtype;
begin
  if viewer is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into author_row from public.authors where profile_id = viewer;
  if author_row.id is null then
    select * into profile_row from public.profiles where id = viewer;
    if profile_row.id is null then raise exception 'PROFILE_NOT_FOUND'; end if;
    insert into public.authors (profile_id, slug, display_name, avatar_url, identity_label)
    values (
      viewer,
      'member-' || replace(viewer::text, '-', ''),
      coalesce(nullif(trim(profile_row.display_name), ''), 'Aesthetic Archive Member'),
      profile_row.avatar_url,
      case profile_row.role when 'admin' then '管理员' when 'reviewer' then '审核员' else '创作者' end
    )
    on conflict (profile_id) do update set updated_at = now()
    returning * into author_row;
  end if;
  return jsonb_build_object(
    'id', author_row.id,
    'public_id', author_row.public_id,
    'profile_id', author_row.profile_id,
    'slug', author_row.slug,
    'display_name', author_row.display_name,
    'avatar_url', author_row.avatar_url,
    'identity_label', author_row.identity_label,
    'bio', author_row.bio,
    'design_focus', author_row.design_focus,
    'is_system', author_row.is_system
  );
end;
$$;

-- Published cards may expose their images; private images remain owner-only.
drop policy if exists "card images objects select own final" on storage.objects;
drop policy if exists "card images objects select own or published final" on storage.objects;
create policy "card images objects select own or published final" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'card-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.card_images i
        join public.aesthetic_cards c on c.id = i.card_id
        where i.storage_path = name
          and c.visibility = 'public'
          and c.publish_status = 'published'
      )
    )
  );

revoke all on function public.ensure_current_author() from public, anon;
grant execute on function public.ensure_current_author() to authenticated;
