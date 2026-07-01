-- supabase/migrations/028_tenant_admins.sql
-- Voegt een admins-array toe aan tenant_config voor Chase.
-- Kluis-toegang in de sidebar wordt beperkt tot gebruikers in deze lijst.

UPDATE public.tenants
SET tenant_config = jsonb_set(
  tenant_config,
  '{admins}',
  '["caesar@newfound.agency"]'::jsonb
)
WHERE hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl');

-- Verificatie
SELECT hostname, tenant_config->'admins' AS admins
FROM public.tenants
WHERE hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl');
