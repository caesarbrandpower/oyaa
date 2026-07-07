-- supabase/migrations/031_allday_staging_tenant.sql
-- Maakt allday-staging.waybetter.nl aan als staging-spiegel van allday.waybetter.nl.
-- Kopieert tenant_config 1-op-1, maar zet tenant_type op 'staging'.

INSERT INTO public.tenants (hostname, name, logo_url, primary_color, enabled_output_types, tenant_config, allowed_email_domains)
SELECT
  'allday-staging.waybetter.nl'                                AS hostname,
  'All Day (staging)'                                          AS name,
  logo_url,
  primary_color,
  enabled_output_types,
  tenant_config || '{"tenant_type": "staging"}'::jsonb        AS tenant_config,
  allowed_email_domains
FROM public.tenants
WHERE hostname = 'allday.waybetter.nl'
ON CONFLICT (hostname) DO NOTHING;

-- Verificatie
SELECT hostname, name, tenant_config->'features' AS features, tenant_config->>'tenant_type' AS tenant_type
FROM public.tenants
WHERE hostname IN ('allday.waybetter.nl', 'allday-staging.waybetter.nl')
ORDER BY hostname;
