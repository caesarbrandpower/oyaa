-- supabase/migrations/029_fix_account_to_pm.sql
-- Vervangt 'account-pm-briefing' door 'account-to-pm' in features.output_types voor Chase.
-- Reden: TaskButtons ROW1_ORDER gebruikt 'account-to-pm'; de DB had nog de oude ID.
-- Beide IDs hebben een prompt en label in custom-prompts.js — geen functionaliteit verloren.

BEGIN;

UPDATE public.tenants
SET tenant_config = jsonb_set(
  tenant_config,
  '{features,output_types}',
  (
    SELECT jsonb_agg(
      CASE WHEN value::text = '"account-pm-briefing"'
           THEN '"account-to-pm"'::jsonb
           ELSE value
      END
    )
    FROM jsonb_array_elements(tenant_config->'features'->'output_types') AS value
  )
)
WHERE hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl');

COMMIT;

-- Verificatie
SELECT hostname, tenant_config->'features'->'output_types' AS output_types
FROM public.tenants
WHERE hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl');
