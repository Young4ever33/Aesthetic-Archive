alter table public.aesthetic_cards
  add column if not exists source_id text,
  add column if not exists source_slug text,
  add column if not exists design_logic text,
  add column if not exists historical_origin text;

create unique index if not exists aesthetic_cards_source_slug_key
  on public.aesthetic_cards (source, source_slug)
  where source_slug is not null;

create index if not exists aesthetic_cards_public_published_idx
  on public.aesthetic_cards (visibility, publish_status);

create index if not exists card_images_card_sort_idx
  on public.card_images (card_id, sort_order);
