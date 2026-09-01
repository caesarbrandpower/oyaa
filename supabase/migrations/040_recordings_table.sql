-- supabase/migrations/040_recordings_table.sql

-- 1. Tabel aanmaken
CREATE TABLE IF NOT EXISTS public.recordings (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id           uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  storage_path        text,
  audio_url           text,
  duration_seconds    numeric,
  client              text,
  title               text,
  transcript_status   text NOT NULL DEFAULT 'done'
    CHECK (transcript_status IN ('queued','processing','done','failed')),
  transcript_error    text,
  speechmatics_job_id text,
  created_at          timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own recordings"
  ON public.recordings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own recordings"
  ON public.recordings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own recordings"
  ON public.recordings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own recordings"
  ON public.recordings FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX ON public.recordings (user_id);
CREATE INDEX ON public.recordings (tenant_id);

-- 2. FK op threads
ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS recording_id uuid REFERENCES public.recordings(id) ON DELETE SET NULL;

-- 3. Backfill: maak recording-rijen van bestaande threads.
-- audio_url bevat een timestamp-pad ({user_id}/{ts}.ext) en is uniek per opname —
-- veilig als join-sleutel. Matchen op created_at zou kunnen botsen bij threads
-- met dezelfde timestamp.
INSERT INTO public.recordings (
  user_id, tenant_id, storage_path, audio_url,
  title, client, transcript_status, transcript_error,
  speechmatics_job_id, created_at
)
SELECT
  t.user_id, t.tenant_id, t.audio_storage_path, t.audio_url,
  t.title, t.client, COALESCE(t.transcript_status, 'done'),
  t.transcript_error, t.speechmatics_job_id, t.created_at
FROM public.threads t
WHERE t.audio_url IS NOT NULL
  AND t.recording_id IS NULL;

-- 4. Backfill recording_id op threads via audio_url als unieke sleutel.
UPDATE public.threads t
SET recording_id = r.id
FROM public.recordings r
WHERE t.audio_url IS NOT NULL
  AND t.recording_id IS NULL
  AND t.audio_url = r.audio_url
  AND t.user_id = r.user_id;
