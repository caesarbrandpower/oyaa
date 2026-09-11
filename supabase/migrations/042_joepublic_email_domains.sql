-- supabase/migrations/042_joepublic_email_domains.sql
-- E-maildomein koppeling voor Joe Public.
-- Nieuwe gebruikers met een @joepublic.nl adres worden automatisch
-- gekoppeld aan deze tenant via de trigger uit migratie 029.

UPDATE public.tenants
SET allowed_email_domains = '["joepublic.nl"]'::jsonb
WHERE hostname = 'joepublic.waybetter.nl';

-- Verificatie
SELECT hostname, allowed_email_domains
FROM public.tenants
WHERE hostname = 'joepublic.waybetter.nl';
