alter table public.ai_providers
  add column if not exists generation_models jsonb not null default '[]'::jsonb,
  add column if not exists default_generation_model text;

comment on column public.ai_providers.image_models is 'Models used for vision/image understanding.';
comment on column public.ai_providers.generation_models is 'Models used for image generation through an explicitly supported adapter.';
