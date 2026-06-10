-- Migratie 015: tenant_type veld in tenant_config
-- Waarden: klant, staging, intern, inactief
-- Zet bekende tenants op het juiste type

update tenants
set tenant_config = tenant_config || '{"tenant_type": "klant"}'::jsonb
where hostname = 'chase.waybetter.nl';

update tenants
set tenant_config = tenant_config || '{"tenant_type": "klant"}'::jsonb
where hostname like '%allday%' or name ilike '%all day%';

update tenants
set tenant_config = tenant_config || '{"tenant_type": "staging"}'::jsonb
where hostname = 'chase-staging.waybetter.nl';

update tenants
set tenant_config = tenant_config || '{"tenant_type": "intern"}'::jsonb
where hostname = 'waybetter.nl';

update tenants
set tenant_config = tenant_config || '{"tenant_type": "inactief"}'::jsonb
where hostname like '%dewolven%' or name ilike '%wolven%';

-- Zet alle tenants zonder type op 'klant' als fallback
update tenants
set tenant_config = coalesce(tenant_config, '{}'::jsonb) || '{"tenant_type": "klant"}'::jsonb
where tenant_config->>'tenant_type' is null;
