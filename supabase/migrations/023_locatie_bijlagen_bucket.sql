-- supabase/migrations/023_locatie_bijlagen_bucket.sql
-- Publieke Storage bucket voor locatie-bijlagen + seed bijlage Bastiaansplein.

-- Bucket aanmaken (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('locatie-bijlagen', 'locatie-bijlagen', true)
ON CONFLICT (id) DO NOTHING;

-- Publieke leestoegang op alle bestanden in de bucket
CREATE POLICY "Public read locatie-bijlagen"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'locatie-bijlagen');

-- Geauthenticeerde gebruikers mogen uploaden
CREATE POLICY "Authenticated upload locatie-bijlagen"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'locatie-bijlagen');

-- Update Bastiaansplein Delft in beide tenants.
-- De PDF wordt handmatig of via de upload-knop in de bucket geplaatst
-- op het pad: locatie-bijlagen/Locatie-instructies_Bastiaansplein_Delft.pdf
UPDATE public.locations
SET bijlagen = '[
  {
    "naam": "Locatie-instructies Bastiaansplein Delft",
    "url": "https://exaaqujxsjsatczstvot.supabase.co/storage/v1/object/public/locatie-bijlagen/Locatie-instructies_Bastiaansplein_Delft.pdf",
    "type": "pdf"
  }
]'::jsonb,
updated_at = now()
WHERE naam = 'Bastiaansplein'
  AND tenant_id IN (
    SELECT id FROM public.tenants
    WHERE hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl')
  );

-- Verificatie
SELECT t.hostname, l.naam, l.bijlagen
FROM public.locations l
JOIN public.tenants t ON t.id = l.tenant_id
WHERE l.naam = 'Bastiaansplein'
ORDER BY t.hostname;
