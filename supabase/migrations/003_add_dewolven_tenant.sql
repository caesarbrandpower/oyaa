-- Seed: dewolven.waybetter.nl
insert into public.tenants (hostname, name, logo_url, primary_color, enabled_output_types, tenant_config)
values (
  'dewolven.waybetter.nl',
  'De Wolven',
  '/logos/de-wolven.svg',
  '#FF4800',
  '["allday-samenvatting","allday-briefing","allday-debrief"]'::jsonb,
  '{"clients":["Algemeen","Woonbond","Patagonia","bol","Museumnacht Amsterdam","Heineken Prizes"]}'::jsonb
);
