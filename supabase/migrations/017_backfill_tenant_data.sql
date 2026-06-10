-- supabase/migrations/017_backfill_tenant_data.sql
-- Datamigratie na de getTenant-fix. Definitief gemaakt op 2026-06-10:
-- STAP 0 is gereviewd door Caesar en de e-maillijsten in STAP 1 en 1b
-- zijn geverifieerd. Vereist dat migratie 016 (user_tenants) al gedraaid is.

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
-- Adressen geverifieerd door Caesar op 2026-06-10 na review van STAP 0.
-- monikaguys@gmail.com blijft bewust ongekoppeld.
-- on conflict maakt herhaald draaien veilig (idempotent).
begin;

insert into public.user_tenants (user_id, tenant_id)
select u.id, (select id from public.tenants where hostname = 'chase.waybetter.nl')
from auth.users u
where u.email in (
  'florien@chase.amsterdam',
  'jaimy@chase.amsterdam',
  'kelly@chase.amsterdam',
  'michel@chase.amsterdam',
  'michel@startthechase.com',
  'mike@chase.amsterdam'
)
on conflict do nothing;

-- STAP 1b: eigen accounts aan de default tenant koppelen
-- zodat lokaal testen (localhost -> waybetter.nl fallback) werkt.
insert into public.user_tenants (user_id, tenant_id)
select u.id, (select id from public.tenants where hostname = 'waybetter.nl')
from auth.users u
where u.email in (
  'caesar@newfound.agency',
  'mailtocaesar@gmail.com',
  'mail@caesarconcepts.nl'
)
on conflict do nothing;

-- STAP 2: zet tenant_id van bestaande threads gelijk aan het tenant-lidmaatschap
-- van de eigenaar. Bij users met meerdere tenants wint Chase.
update public.threads t
set tenant_id = ut.tenant_id
from public.user_tenants ut
join public.tenants tn on tn.id = ut.tenant_id
where ut.user_id = t.user_id
  and tn.hostname = 'chase.waybetter.nl';

commit;

-- STAP 3 (controle): geen threads meer op het verkeerde tenant_id voor Chase-users?
select tn.hostname, count(*) from public.threads t
join public.tenants tn on tn.id = t.tenant_id
group by tn.hostname;
