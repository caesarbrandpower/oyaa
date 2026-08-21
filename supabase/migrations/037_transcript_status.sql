-- Voeg transcript_status toe aan threads.
-- DEFAULT 'done': bestaande threads hebben al een transcript en hoeven niet opnieuw verwerkt te worden.
ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS transcript_status text NOT NULL DEFAULT 'done'
    CHECK (transcript_status IN ('queued', 'processing', 'done', 'failed')),
  ADD COLUMN IF NOT EXISTS transcript_error text;
