-- supabase/migrations/021_locations.sql
-- Locatiedatabase: veldlocaties per tenant met vergunningsstatus en details.

CREATE TABLE public.locations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  naam text NOT NULL,
  stad text,
  channel text,
  doelgroep text,
  parkeren text,
  laden_lossen text,
  vergunning_status text CHECK (vergunning_status IN ('aanwezig', 'verlopen', 'geen')),
  vergunning_vervaldatum date,
  bijzonderheden text,
  historische_aantallen jsonb,
  bijlagen jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX locations_tenant_idx ON public.locations (tenant_id);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Lezen: alleen leden van de tenant
CREATE POLICY "Tenant members read locations"
  ON public.locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.tenant_id = locations.tenant_id
    )
  );

-- Schrijven: tenant-leden kunnen locaties aanmaken en bewerken
CREATE POLICY "Tenant members insert locations"
  ON public.locations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.tenant_id = locations.tenant_id
    )
  );

CREATE POLICY "Tenant members update locations"
  ON public.locations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.tenant_id = locations.tenant_id
    )
  );

-- Seed: 8 fictieve locaties voor Chase (demo)
INSERT INTO public.locations (
  tenant_id, naam, stad, channel, doelgroep,
  parkeren, laden_lossen, vergunning_status, vergunning_vervaldatum, bijzonderheden
)
SELECT
  t.id,
  v.naam, v.stad, v.channel, v.doelgroep,
  v.parkeren, v.laden_lossen, v.vergunning_status::text, v.vergunning_vervaldatum::date, v.bijzonderheden
FROM public.tenants t,
(VALUES
  ('Rotterdam Centraal', 'Rotterdam', 'Treinstation', '18-30',
   'Beperkt, P+R aanbevolen', 'Ingang Stationsplein, ingang B',
   'aanwezig', '2026-12-31', null),

  ('Coolsingel', 'Rotterdam', 'Centrumlocatie', '30-45',
   'Betaald parkeren omgeving', 'Tijdvak 07:00-09:00, ontheffing aanvragen',
   'verlopen', null, 'Vergunning verlopen per 1 maart 2026, verlenging in behandeling'),

  ('Hoog Catharijne', 'Utrecht', 'Winkelcentrum', 'Gezinnen',
   'Hoog Catharijne parkeergarage, €3/uur', 'Via laaddock ingang Jaarbeursplein',
   'geen', null, 'Locatiebeheer verhuurt op basis van dagvergunning, geen vaste vergunning'),

  ('Schiphol Plaza', 'Schiphol', 'Treinstation', '25-40',
   'Niet van toepassing (vliegveld)', 'Laden via beveiligingsingang, tijdslot verplicht',
   'aanwezig', '2027-03-15', 'Coördinatie via Schiphol events team, minimaal 4 weken vooraf aanvragen'),

  ('Bastiaansplein', 'Delft', 'Centrumlocatie', '30-45',
   'Parkeren Zuidpoort, 5 min lopen', 'Opbouw toegestaan voor 08:00',
   'aanwezig', '2026-09-30', 'Opbouw verplicht voor 08:00. Na 09:00 geen voertuigen meer op het plein.'),

  ('Vondelpark', 'Amsterdam', 'Outdoor', '18-35',
   'Geen parkeren op locatie, OV aanbevolen', 'Ingang Stadhouderskade, handkar verplicht',
   'aanwezig', '2026-10-01', 'Seizoensvergunning: geldig 1 april t/m 1 oktober. Buiten seizoen niet beschikbaar.'),

  ('Blaak Markt', 'Rotterdam', 'Markt', 'Breed publiek',
   'Marktvakken, eigen parkeerplaats mogelijk aanvragen', 'Via Binnenrotte, toegang 06:00-07:30',
   'aanwezig', '2026-12-31', 'Alleen beschikbaar op zaterdag. Standplaats via marktbeheer aanvragen.'),

  ('Ziggo Dome', 'Amsterdam', 'Event', '18-35',
   'Ziggo Dome parkeergarage P1/P2', 'Laden via backstage-ingang, tijdslot via eventcoördinator',
   'aanwezig', null, 'Vergunning loopt via de locatie zelf. Coördinatie met eventcoördinator Ziggo Dome verplicht.')
) AS v(naam, stad, channel, doelgroep, parkeren, laden_lossen, vergunning_status, vergunning_vervaldatum, bijzonderheden)
WHERE t.hostname = 'chase.waybetter.nl';

-- Verificatie: hoeveel locaties zijn er aangemaakt?
SELECT t.hostname, count(l.id) as locaties
FROM public.tenants t
LEFT JOIN public.locations l ON l.tenant_id = t.id
GROUP BY t.hostname
ORDER BY t.hostname;
