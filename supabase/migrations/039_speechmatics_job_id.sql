-- Sla het Speechmatics job-ID op zodat de cron-fallback en de retry-flow
-- openstaande jobs kunnen ophalen zonder opnieuw te hoeven inloggen.
-- audio_storage_path maakt handmatig opnieuw transcriberen vanuit Storage
-- mogelijk zolang het bestand er staat (ook na de 7-daagse Speechmatics-retentie).
ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS speechmatics_job_id text,
  ADD COLUMN IF NOT EXISTS audio_storage_path text;
