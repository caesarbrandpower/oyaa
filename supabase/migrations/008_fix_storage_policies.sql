-- Verwijder oude policies die niet werken
DROP POLICY IF EXISTS "Auth users can upload client logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload briefing media" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update client logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update briefing media" ON storage.objects;

-- Gecombineerde INSERT policy voor beide buckets
CREATE POLICY "Give users access to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('client-logos', 'briefing-media'));

-- UPDATE policy voor upsert
CREATE POLICY "Give users update access"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id IN ('client-logos', 'briefing-media'));
