alter table public.ai_usage_logs add column if not exists request_id text;
alter table public.ai_usage_logs add column if not exists duration_ms integer;
create index if not exists ai_usage_logs_owner_created_idx on public.ai_usage_logs(owner_id, created_at desc);
