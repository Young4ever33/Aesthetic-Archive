-- Provider Vault runs under the authenticated user session and remains owner-scoped by RLS.
-- Ciphertext is available only to trusted API routes through this auth.uid()-bound function.

grant select (
  generation_models,
  default_generation_model
) on table public.ai_providers to authenticated;

grant insert, update, delete on table public.ai_providers to authenticated;

create or replace function public.get_owned_provider_secret(p_provider_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  type text,
  encrypted_api_key text,
  base_url text,
  image_capable boolean,
  image_models jsonb,
  generation_models jsonb,
  text_models jsonb,
  default_image_model text,
  default_generation_model text,
  default_text_model text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.owner_id,
    p.name,
    p.type,
    p.encrypted_api_key,
    p.base_url,
    p.image_capable,
    p.image_models,
    p.generation_models,
    p.text_models,
    p.default_image_model,
    p.default_generation_model,
    p.default_text_model
  from public.ai_providers p
  where p.id = p_provider_id
    and p.owner_id = auth.uid();
$$;

revoke all on function public.get_owned_provider_secret(uuid) from public, anon;
grant execute on function public.get_owned_provider_secret(uuid) to authenticated;
