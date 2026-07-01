-- supabase/migrations/024_suppliers.sql
-- Leveranciersdatabase: tabel, RLS, feature flag, seed data.

-- ─── Tabel ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.suppliers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  naam              text NOT NULL,
  categorie         text,
  contactpersoon    text,
  telefoon          text,
  email             text,
  website           text,
  regio             text,
  levertijd         text,
  prijsindicatie    text,
  beoordeling       text DEFAULT 'neutraal',
  bijzonderheden    text,
  bijlagen          jsonb DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ingelogde gebruikers zien leveranciers van hun tenant"
  ON public.suppliers FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Ingelogde gebruikers mogen leveranciers aanmaken"
  ON public.suppliers FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Ingelogde gebruikers mogen leveranciers bijwerken"
  ON public.suppliers FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()
    )
  );

-- ─── Feature flag: suppliers: false voor alle tenants ─────────────────────────

UPDATE public.tenants
SET tenant_config = jsonb_set(tenant_config, '{features,suppliers}', 'false'::jsonb)
WHERE tenant_config->'features' IS NOT NULL;

-- ─── Feature flag: suppliers: true voor Chase ─────────────────────────────────

UPDATE public.tenants
SET tenant_config = jsonb_set(tenant_config, '{features,suppliers}', 'true'::jsonb)
WHERE hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl');

-- ─── Seed data: 8 leveranciers voor beide Chase-tenants ──────────────────────

INSERT INTO public.suppliers (
  tenant_id, naam, categorie, contactpersoon, telefoon, email, website,
  regio, levertijd, prijsindicatie, beoordeling, bijzonderheden
)
SELECT
  t.id,
  v.naam, v.categorie, v.contactpersoon, v.telefoon, v.email, v.website,
  v.regio, v.levertijd, v.prijsindicatie, v.beoordeling, v.bijzonderheden
FROM public.tenants t,
(VALUES
  (
    'PromoWear NL', 'materiaal', 'Jeroen van Dam', '020-123 4567',
    'jeroen@promowear.nl', 'promowear.nl',
    'Nationaal', '5 werkdagen', '€ 8 - €25 per stuk',
    'goed', 'Specialisatie in bedrukte kleding en caps. Minimale afname 25 stuks. Accountmanager Jeroen is erg meedenker.'
  ),
  (
    'Standenbouw Oost', 'materiaal', 'Lisa Hofman', '053-456 7890',
    'lisa@standenbouwoost.nl', 'standenbouwoost.nl',
    'Oost-NL', '10 werkdagen', '€ 500 - €3.000 per project',
    'neutraal', 'Bouwen modulaire evenementstands. Levertijd is krap bij piekmomenten; tijdig bestellen. Offerte vaak aan de hoge kant.'
  ),
  (
    'FreshFuel Catering', 'catering', 'Mieke Smits', '010-789 0123',
    'mieke@freshfuel.nl', 'freshfuel.nl',
    'Randstad', '2 werkdagen', '€ 12 - €22 per persoon',
    'goed', 'Gezonde streetfood en koffie/thee op locatie. Vegetarisch/vegan altijd beschikbaar. Eigen generator aanwezig.'
  ),
  (
    'SpeedPrint Amsterdam', 'drukwerk', 'Tom de Bruin', '020-234 5678',
    'tom@speedprint.nl', 'speedprint.nl',
    'Amsterdam', '3 werkdagen', '€ 0,10 - €2,00 per vel',
    'goed', 'Spoedopdrachten altijd mogelijk tegen toeslag. Groot formaat (A0) beschikbaar. Ophalen in Amsterdam-Oost.'
  ),
  (
    'TransportDirect', 'transport', 'Kees Bakker', '0800-123 456',
    'kees@transportdirect.nl', 'transportdirect.nl',
    'Nationaal', '1 werkdag', '€ 150 - €450 per rit',
    'goed', 'Bezorging en ophaaldienst voor evenementenmateriaal. Laadklep beschikbaar. 24/7 bereikbaar in week van evenement.'
  ),
  (
    'TechEvent Solutions', 'techniek', 'Roos van Leeuwen', '030-567 8901',
    'roos@techevent.nl', 'techevent.nl',
    'Nationaal', '7 werkdagen', '€ 250 - €1.500 per dag',
    'neutraal', 'LED-schermen, geluidsinstallaties en belichting. Technische bemanning inbegrepen. Soms moeizame communicatie in afstemfase.'
  ),
  (
    'GreenGifts BV', 'materiaal', 'Anna Vermeer', '040-678 9012',
    'anna@greengifts.nl', 'greengifts.nl',
    'Nationaal', '8 werkdagen', '€ 5 - €40 per stuk',
    'goed', 'Duurzame relatiegeschenken en giveaways. B-corp gecertificeerd. Maatwerk mogelijk vanaf 50 stuks. Goede ESG-rapportage beschikbaar.'
  ),
  (
    'CityStorage Rotterdam', 'opslag', 'Mark Jansen', '010-890 1234',
    'mark@citystorage.nl', 'citystorage.nl',
    'Rotterdam', 'Direct beschikbaar', '€ 80 - €200 per maand',
    'neutraal', 'Klimaatgecontroleerde opslagunits voor materiaal tussen events. Units van 5m² t/m 50m². Toegang 7 dagen per week.'
  )
) AS v(naam, categorie, contactpersoon, telefoon, email, website, regio, levertijd, prijsindicatie, beoordeling, bijzonderheden)
WHERE t.hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl');

-- ─── Verificatie ─────────────────────────────────────────────────────────────

SELECT t.hostname, count(s.id) AS aantal_leveranciers
FROM public.tenants t
LEFT JOIN public.suppliers s ON s.tenant_id = t.id
WHERE t.hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl')
GROUP BY t.hostname
ORDER BY t.hostname;
