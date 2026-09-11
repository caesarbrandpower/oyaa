-- Per-klant sjabloonkoppeling voor Chase.
-- tenant_config.client_template_map: { themeKey: [alias, ...] }
-- Alle schrijfwijzen van Coca-Cola worden gekoppeld aan het 'coca-cola' thema.
-- Nieuwe schrijfwijzen toevoegen via: jsonb_set + || operator, of direct in Supabase Studio.

UPDATE public.tenants
SET tenant_config = jsonb_set(
  tenant_config,
  '{client_template_map}',
  '{
    "coca-cola": [
      "The Coca-Cola Company",
      "Coca-Cola",
      "Coca-Cola Zero",
      "Coca-Cola Zero Sugar",
      "Coca-Cola Light",
      "Coca-Cola Original",
      "TCCC"
    ]
  }'::jsonb,
  true
)
WHERE hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl');
