-- Make card likes deterministic for both user UUID cards and registered Seed cards.

create or replace function public.toggle_card_like(target_key text, should_like boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  target_card_id uuid;
  target_system_key text;
  target_author_id uuid;
  target_recipient_id uuid;
  target_owner_id uuid;
  target_title text;
  inserted_like_id uuid;
  current_count bigint;
  liked_now boolean;
begin
  if viewer is null then raise exception 'UNAUTHENTICATED'; end if;

  if target_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select c.id, c.author_id, c.owner_id, coalesce(nullif(c.title_zh, ''), c.title)
      into target_card_id, target_author_id, target_owner_id, target_title
    from public.aesthetic_cards c
    where c.id = target_key::uuid
      and c.visibility = 'public'
      and c.publish_status = 'published';

    if target_card_id is null then raise exception 'CARD_NOT_PUBLIC'; end if;
    if target_owner_id = viewer then raise exception 'OWN_CARD_LIKE_FORBIDDEN'; end if;
  else
    select c.card_key, c.author_id, coalesce(nullif(c.title_zh, ''), c.title)
      into target_system_key, target_author_id, target_title
    from public.system_cards c
    where c.card_key = target_key;

    if target_system_key is null then raise exception 'CARD_NOT_FOUND'; end if;
  end if;

  select a.profile_id into target_recipient_id
  from public.authors a
  where a.id = target_author_id;
  if target_author_id is null or not found then raise exception 'AUTHOR_NOT_FOUND'; end if;

  if should_like then
    if target_card_id is not null then
      insert into public.card_likes(card_id, user_id, author_id)
      values (target_card_id, viewer, target_author_id)
      on conflict do nothing
      returning id into inserted_like_id;
    else
      insert into public.card_likes(system_card_key, user_id, author_id)
      values (target_system_key, viewer, target_author_id)
      on conflict do nothing
      returning id into inserted_like_id;
    end if;

    if inserted_like_id is not null and target_recipient_id is not null and target_recipient_id <> viewer then
      insert into public.notifications(recipient_id, actor_id, type, card_id, system_card_key, author_id, like_id, payload)
      values (
        target_recipient_id,
        viewer,
        'card_liked',
        target_card_id,
        target_system_key,
        target_author_id,
        inserted_like_id,
        jsonb_build_object('cardTitle', target_title)
      );
    end if;
  else
    if target_card_id is not null then
      delete from public.card_likes where card_id = target_card_id and user_id = viewer;
    else
      delete from public.card_likes where system_card_key = target_system_key and user_id = viewer;
    end if;
  end if;

  if target_card_id is not null then
    select count(*), exists(
      select 1 from public.card_likes where card_id = target_card_id and user_id = viewer
    ) into current_count, liked_now
    from public.card_likes where card_id = target_card_id;
  else
    select count(*), exists(
      select 1 from public.card_likes where system_card_key = target_system_key and user_id = viewer
    ) into current_count, liked_now
    from public.card_likes where system_card_key = target_system_key;
  end if;

  return jsonb_build_object('liked', liked_now, 'likeCount', current_count);
end;
$$;

revoke all on function public.toggle_card_like(text, boolean) from public, anon;
grant execute on function public.toggle_card_like(text, boolean) to authenticated;
