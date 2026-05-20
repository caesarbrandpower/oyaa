-- Storage policies for client-logos and briefing-media buckets
-- Run after creating both buckets (public) in Supabase dashboard

CREATE POLICY "Auth users can upload client logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client-logos');

CREATE POLICY "Auth users can upload briefing media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'briefing-media');
