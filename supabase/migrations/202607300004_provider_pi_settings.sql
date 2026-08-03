alter table public.ai_providers add column if not exists api_type text;
alter table public.ai_providers add column if not exists compat jsonb default '{}'::jsonb;
alter table public.ai_providers add column if not exists headers jsonb default '{}'::jsonb;
