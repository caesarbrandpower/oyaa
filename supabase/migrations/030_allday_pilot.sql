-- supabase/migrations/030_allday_pilot.sql
-- All Day Productions pilot: output types + features instellen.
-- Migreert allday van het oude allday-* type-systeem naar de nieuwe custom-prompts architectuur.

-- STAP 1: vervang output_types
UPDATE public.tenants
SET tenant_config = jsonb_set(
  tenant_config,
  '{features,output_types}',
  '["allday-gespreksverslag","allday-debrief"]'::jsonb
)
WHERE hostname = 'allday.waybetter.nl';

-- STAP 2: zet feature flags
UPDATE public.tenants
SET tenant_config = tenant_config
  || jsonb_build_object('features', (tenant_config->'features')
    || jsonb_build_object(
      'free_chat',  true,
      'locations',  true,
      'suppliers',  true,
      'recording',  true,
      'vault',      false
    ))
WHERE hostname = 'allday.waybetter.nl';

-- STAP 3: e-maildomeinen voor automatische koppeling (zie migratie 029)
UPDATE public.tenants
SET allowed_email_domains = '["allday.amsterdam","wedothisallday.com"]'::jsonb
WHERE hostname = 'allday.waybetter.nl';

-- TODO: stel logo_url in via Supabase dashboard zodra het All Day-logo
-- geüpload is naar Supabase Storage.
-- Huidig logo staat lokaal op: public/logos/all-day-productions.svg

-- Verificatie
SELECT hostname,
       tenant_config->'features' AS features,
       allowed_email_domains
FROM public.tenants
WHERE hostname = 'allday.waybetter.nl';
