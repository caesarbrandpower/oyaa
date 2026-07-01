-- supabase/migrations/025_database_improvements.sql
-- Verbeteringen aan leveranciers- en locatiedatabase:
-- + omschrijving kolom op beide tabellen
-- + telefoon/email/website op locations
-- + beoordeling suppliers geen default meer
-- + omschrijving seed data

-- ─── Kolommen toevoegen ───────────────────────────────────────────────────────

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS omschrijving text;

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS omschrijving text,
  ADD COLUMN IF NOT EXISTS telefoon text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS website text;

-- Verwijder 'neutraal' als default voor beoordeling
-- (badge toont alleen als waarde bewust is ingesteld)
ALTER TABLE public.suppliers
  ALTER COLUMN beoordeling DROP DEFAULT;

-- ─── Omschrijving seed: leveranciers ─────────────────────────────────────────

UPDATE public.suppliers SET omschrijving = 'Specialist in bedrukte promotiekleding, caps en accessoires. Hoge kwaliteit printwerk met snelle levering, ook voor kleinere oplagen.'
  WHERE naam = 'PromoWear NL';

UPDATE public.suppliers SET omschrijving = 'Bouwt modulaire evenementstands en pop-up displays voor beurzen en brand activations. Maatwerk en verhuur mogelijk.'
  WHERE naam = 'Standenbouw Oost';

UPDATE public.suppliers SET omschrijving = 'Gezonde streetfoodconcepten en barista-koffie voor events en brand activations. Volledig zelfvoorzienend met eigen materieel.'
  WHERE naam = 'FreshFuel Catering';

UPDATE public.suppliers SET omschrijving = 'Drukkerij gespecialiseerd in groot- en kleinformaat drukwerk voor events. Spoedservice beschikbaar, ophalen in Amsterdam-Oost.'
  WHERE naam = 'SpeedPrint Amsterdam';

UPDATE public.suppliers SET omschrijving = 'Landelijke bezorg- en ophaaldienst voor evenementenmateriaal en stands. Laadklep aanwezig, 24/7 bereikbaar rond evenementdagen.'
  WHERE naam = 'TransportDirect';

UPDATE public.suppliers SET omschrijving = 'Levert en installeert LED-schermen, geluidsinstallaties en belichting voor evenementen. Eigen technici altijd inbegrepen.'
  WHERE naam = 'TechEvent Solutions';

UPDATE public.suppliers SET omschrijving = 'Producent van duurzame en gecertificeerde relatiegeschenken en giveaways. B-corp gecertificeerd, ESG-rapportage op aanvraag.'
  WHERE naam = 'GreenGifts BV';

UPDATE public.suppliers SET omschrijving = 'Klimaatgecontroleerde opslagruimte voor evenementenmateriaal tussen activaties door. Zeven dagen per week toegankelijk.'
  WHERE naam = 'CityStorage Rotterdam';

-- ─── Omschrijving seed: locaties ─────────────────────────────────────────────

UPDATE public.locations SET omschrijving = 'Druk intercitystation in hartje Rotterdam met meer dan 110.000 reizigers per dag. Ideaal voor merken die een breed, mobiel publiek willen bereiken.'
  WHERE naam = 'Rotterdam Centraal';

UPDATE public.locations SET omschrijving = 'Iconische winkelstraat in het centrum van Rotterdam met hoge voetgangersintensiteit. Goede zichtbaarheid voor brand activations gericht op 30-45 jaar.'
  WHERE naam = 'Coolsingel';

UPDATE public.locations SET omschrijving = 'Grootste overdekte winkelcentrum van Nederland, direct verbonden met Utrecht Centraal. Hoge bezoekersdichtheid, ook bij slecht weer ideaal.'
  WHERE naam = 'Hoog Catharijne';

UPDATE public.locations SET omschrijving = 'Publiekszone van Amsterdam Airport Schiphol met meer dan 150.000 passagiers en bezoekers per dag. Internationaal en goed opgeleid publiek.'
  WHERE naam = 'Schiphol Plaza';

UPDATE public.locations SET omschrijving = 'Levendig plein in het centrum van Delft, omgeven door horeca en winkels. Rustige setting voor langere merkinteracties met een stedelijk publiek.'
  WHERE naam = 'Bastiaansplein';

UPDATE public.locations SET omschrijving = 'Amsterdam''s bekendste stadspark met intensief gebruik door recreanten en toeristen. Seizoenslocatie, ideaal voor outdoor brand experiences.'
  WHERE naam = 'Vondelpark';

UPDATE public.locations SET omschrijving = 'Weekmarkt in Rotterdam op zaterdag met een breed en trouw publiek. Directe sfeer en hoge doorstroom maken het geschikt voor sampling activaties.'
  WHERE naam = 'Blaak Markt';

UPDATE public.locations SET omschrijving = 'Grootste evenementenhal van Nederland met capaciteit voor 17.000 bezoekers. Beschikbaar voor brand activations rondom concerten en grote evenementen.'
  WHERE naam = 'Ziggo Dome';

-- ─── Verificatie ─────────────────────────────────────────────────────────────

SELECT naam, left(omschrijving, 60) AS omschrijving_preview
FROM public.suppliers
WHERE omschrijving IS NOT NULL
ORDER BY naam;

SELECT naam, left(omschrijving, 60) AS omschrijving_preview
FROM public.locations
WHERE omschrijving IS NOT NULL
ORDER BY naam;
