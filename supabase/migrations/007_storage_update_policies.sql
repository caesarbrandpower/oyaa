-- UPDATE policies needed for upsert (upload with upsert:true uses PUT when file exists)

CREATE POLICY "Auth users can update client logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'client-logos');

CREATE POLICY "Auth users can update briefing media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'briefing-media');
