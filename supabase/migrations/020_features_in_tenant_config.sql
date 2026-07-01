-- supabase/migrations/020_features_in_tenant_config.sql
-- Centraliseert feature flags naar tenant_config.features.
-- Bestaande kolom enabled_output_types blijft als backup; pas droppen na twee weken stabiele productie.

-- STAP 0 (alleen lezen — eerst reviewen voor je de UPDATE draait):
-- Huidige staat per tenant.
select
  hostname,
  tenant_config,
  enabled_output_types
from public.tenants
order by hostname;

-- STAP 1: bouw features object op vanuit bestaande data.
-- Verwerkt zowel string-arrays als object-arrays in enabled_output_types.
begin;

update public.tenants
set tenant_config = tenant_config || jsonb_build_object(
  'features', jsonb_build_object(
    'free_chat', true,
    'vault',     coalesce((tenant_config->>'vault_enabled')::boolean, false),
    'locations', false,
    'recording', true,
    'output_types', (
      select coalesce(
        jsonb_agg(
          case
            when jsonb_typeof(item) = 'object' then item->>'id'
            else item #>> '{}'
          end
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(
        case
          when jsonb_typeof(enabled_output_types) = 'array' then enabled_output_types
          else '[]'::jsonb
        end
      ) as item
    )
  )
);

commit;

-- STAP 2 (controle — draai na de UPDATE):
-- Verifieer dat features correct gebouwd is per tenant.
select
  hostname,
  tenant_config->'features'                    as features,
  tenant_config->'features'->'output_types'    as output_types,
  tenant_config->'features'->>'vault'          as vault,
  enabled_output_types                         as oude_output_types
from public.tenants
order by hostname;
