-- Tenants table
create table public.tenants (
  id uuid default gen_random_uuid() primary key,
  hostname text not null unique,
  name text not null,
  logo_url text,
  primary_color text not null default '#FF4800',
  enabled_output_types jsonb not null default '[]'::jsonb,
  tenant_config jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.tenants enable row level security;

-- Tenant config is public read — geen auth nodig voor branding ophalen
create policy "Tenants are publicly readable"
  on public.tenants for select
  using (true);

-- Seed: waybetter.nl (default)
insert into public.tenants (hostname, name, logo_url, primary_color, enabled_output_types, tenant_config)
values (
  'waybetter.nl',
  'Waybetter',
  null,
  '#FF4800',
  '["summary-actions","internal-briefing","external-debrief","internal-actions","external-actions","project-planning","supplier-briefing","staff-planning","client-status"]'::jsonb,
  '{}'::jsonb
);

-- Seed: chase.waybetter.nl
insert into public.tenants (hostname, name, logo_url, primary_color, enabled_output_types, tenant_config)
values (
  'chase.waybetter.nl',
  'Chase',
  'https://www.chase.amsterdam/content/themes/chase/images/chase-brand-activation-white.svg',
  '#FF4800',
  '["summary-actions","internal-briefing","external-debrief","internal-actions","external-actions","project-planning","supplier-briefing","staff-planning","client-status"]'::jsonb,
  '{}'::jsonb
);

-- Seed: allday.waybetter.nl
-- Pas logo_url aan naar de juiste URL van wedothisallday.com na het uitvoeren van deze migratie
insert into public.tenants (hostname, name, logo_url, primary_color, enabled_output_types, tenant_config)
values (
  'allday.waybetter.nl',
  'All Day',
  null,
  '#FF4800',
  '["allday-samenvatting","allday-briefing","allday-debrief"]'::jsonb,
  '{"recipients":["team","klant","leverancier","directie"]}'::jsonb
);
