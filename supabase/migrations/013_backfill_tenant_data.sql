-- supabase/migrations/013_backfill_tenant_data.sql
-- Datamigratie na de getTenant-fix. NIET blind draaien:
-- voer STAP 0 uit, controleer de e-mailadressen, en pas STAP 1 aan
-- voor accounts die NIET bij Chase horen (eigen testaccounts e.d.).

-- STAP 0 (alleen lezen, eerst reviewen):
-- welke users bestaan er, hoeveel threads hebben ze, en welk tenant_id staat er nu?
select u.id, u.email, count(t.id) as threads,
       array_agg(distinct tn.hostname) as huidige_tenants
from auth.users u
left join public.threads t on t.user_id = u.id
left join public.tenants tn on tn.id = t.tenant_id
group by u.id, u.email
order by u.email;

-- STAP 1: koppel users aan de Chase-tenant.
-- Chase is de enige live klant; verwijder hieronder expliciet de user_ids
-- van eigen test-/beheeraccounts of geef die een andere tenant.
insert into public.user_tenants (user_id, tenant_id)
select u.id, (select id from public.tenants where hostname = 'chase.waybetter.nl')
from auth.users u
-- where u.email not in ('eigen-testaccount@voorbeeld.nl')  -- aanpassen na review STAP 0
on conflict do nothing;

-- STAP 1b (optioneel): eigen account ook aan de default tenant koppelen
-- zodat lokaal testen (localhost -> waybetter.nl fallback) werkt.
-- insert into public.user_tenants (user_id, tenant_id)
-- select u.id, (select id from public.tenants where hostname = 'waybetter.nl')
-- from auth.users u where u.email = 'eigen-account@voorbeeld.nl'
-- on conflict do nothing;

-- STAP 2: zet tenant_id van bestaande threads gelijk aan het tenant-lidmaatschap
-- van de eigenaar. Bij users met meerdere tenants wint Chase.
update public.threads t
set tenant_id = ut.tenant_id
from public.user_tenants ut
join public.tenants tn on tn.id = ut.tenant_id
where ut.user_id = t.user_id
  and tn.hostname = 'chase.waybetter.nl';

-- STAP 3 (controle): geen threads meer op het verkeerde tenant_id voor Chase-users?
select tn.hostname, count(*) from public.threads t
join public.tenants tn on tn.id = t.tenant_id
group by tn.hostname;
