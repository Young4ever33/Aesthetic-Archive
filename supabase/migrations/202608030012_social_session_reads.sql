-- Public social reads run through authenticated, narrowly scoped functions.
-- No email, private card, Provider, or notification payload is exposed.

create or replace function public.get_card_interactions(target_keys text[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select distinct key
    from unnest(coalesce(target_keys, array[]::text[])) as key
    where key ~ '^[A-Z]-[0-9]{2}$'
       or key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    limit 100
  ), targets as (
    select
      r.key,
      c.owner_id,
      a.public_id,
      a.display_name,
      a.avatar_url,
      a.identity_label,
      a.is_system
    from requested r
    join public.aesthetic_cards c
      on r.key ~* '^[0-9a-f-]{36}$' and c.id = r.key::uuid
    left join public.authors a on a.id = c.author_id
    where c.visibility = 'public' and c.publish_status = 'published'
    union all
    select
      r.key,
      null::uuid,
      a.public_id,
      a.display_name,
      a.avatar_url,
      a.identity_label,
      a.is_system
    from requested r
    join public.system_cards c on c.card_key = r.key
    left join public.authors a on a.id = c.author_id
  ), metrics as (
    select
      t.*,
      (select count(*) from public.card_likes l where l.card_id::text = t.key or l.system_card_key = t.key) as like_count,
      exists(select 1 from public.card_likes l where l.user_id = auth.uid() and (l.card_id::text = t.key or l.system_card_key = t.key)) as liked
    from targets t
  )
  select coalesce(jsonb_object_agg(key, jsonb_build_object(
    'likedByViewer', liked,
    'likeCount', like_count,
    'ownCard', owner_id = auth.uid(),
    'author', case when public_id is null then null else jsonb_build_object(
      'publicId', public_id,
      'name', display_name,
      'avatar', coalesce(avatar_url, ''),
      'role', case when is_system then 'curator' else 'user' end,
      'identity', identity_label,
      'isSystem', is_system
    ) end
  )), '{}'::jsonb)
  from metrics;
$$;

create or replace function public.get_public_author_summary(target_public_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'publicId', a.public_id,
    'slug', a.slug,
    'name', a.display_name,
    'avatar', coalesce(a.avatar_url, ''),
    'identity', a.identity_label,
    'bio', coalesce(a.bio, ''),
    'designFocus', coalesce(a.design_focus, ''),
    'isSystem', a.is_system,
    'isSelf', a.profile_id = auth.uid(),
    'following', exists(select 1 from public.author_follows f where f.author_id = a.id and f.follower_id = auth.uid()),
    'followerCount', (select count(*) from public.author_follows f where f.author_id = a.id),
    'followingCount', case when a.profile_id is null then 0 else (select count(*) from public.author_follows f where f.follower_id = a.profile_id) end,
    'cardCount',
      (select count(*) from public.aesthetic_cards c where c.author_id = a.id and c.visibility = 'public' and c.publish_status = 'published')
      + (select count(*) from public.system_cards c where c.author_id = a.id)
  )
  from public.authors a
  where a.public_id = target_public_id;
$$;

revoke all on function public.get_card_interactions(text[]) from public, anon;
grant execute on function public.get_card_interactions(text[]) to authenticated;
revoke all on function public.get_public_author_summary(uuid) from public, anon;
grant execute on function public.get_public_author_summary(uuid) to authenticated;
