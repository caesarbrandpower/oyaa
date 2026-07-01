-- supabase/migrations/022_activate_locations_chase.sql
-- Activeert features.locations voor Chase productie en staging.
-- Draai dit pas nadat de pagina op staging getest en goedgekeurd is.

-- STAP 0 (lezen, controleer eerst):
SELECT hostname, tenant_config->'features' AS features
FROM public.tenants
WHERE hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl');

-- STAP 1: zet locations aan voor Chase
BEGIN;

UPDATE public.tenants
SET tenant_config = jsonb_set(
  tenant_config,
  '{features,locations}',
  'true'::jsonb
)
WHERE hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl');

COMMIT;

-- STAP 2 (verificatie):
SELECT hostname, tenant_config->'features'->>'locations' AS locations_flag
FROM public.tenants
WHERE hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl');
