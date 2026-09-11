-- supabase/migrations/041_joepublic_tenant.sql
-- Joe Public tenant aanmaken als kopie van Chase.
-- Zelfde output types, feature flags, admins en primaire kleur.
-- allowed_email_domains: vul in zodra het e-maildomein van Joe Public bekend is.

INSERT INTO public.tenants (
  hostname,
  name,
  primary_color,
  enabled_output_types,
  tenant_config,
  allowed_email_domains
)
VALUES (
  'joepublic.waybetter.nl',
  'Joe Public',
  '#FF4800',
  '[]'::jsonb,
  '{
    "admins": ["caesar@newfound.agency"],
    "tenant_type": "klant",
    "features": {
      "free_chat": true,
      "vault": false,
      "locations": false,
      "suppliers": false,
      "recording": true,
      "output_types": [
        "account-to-pm",
        "field-briefing",
        "external-debrief",
        "account-to-creation",
        "meeting-summary"
      ]
    }
  }'::jsonb,
  '[]'::jsonb
);

-- Verificatie
SELECT hostname, name, primary_color,
       tenant_config->'features' AS features,
       tenant_config->'admins'   AS admins,
       allowed_email_domains
FROM public.tenants
WHERE hostname = 'joepublic.waybetter.nl';
