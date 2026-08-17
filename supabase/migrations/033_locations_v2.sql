-- supabase/migrations/033_locations_v2.sql
-- Uitbreiding locatiedatabase: prijs/bereik/status + audit.

-- ─── Nieuwe kolommen ───────────────────────────────────────────────────────────

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS adres        text,
  ADD COLUMN IF NOT EXISTS prijs        numeric,
  ADD COLUMN IF NOT EXISTS prijssoort   text CHECK (prijssoort IN ('huurprijs', 'vergunningskosten')),
  ADD COLUMN IF NOT EXISTS bereik       integer,
  ADD COLUMN IF NOT EXISTS bereik_note  text,
  ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'onbekend'
                                          CHECK (status IN ('actief', 'vervallen', 'onbekend')),
  ADD COLUMN IF NOT EXISTS bron         text,
  ADD COLUMN IF NOT EXISTS extra        jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─── UNIQUE constraint: geen dubbele namen per tenant ─────────────────────────

ALTER TABLE public.locations
  ADD CONSTRAINT locations_tenant_naam_unique UNIQUE (tenant_id, naam);

-- ─── Audit-tabel ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.location_changes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL,
  user_id     uuid NOT NULL,
  gewijzigd_via text NOT NULL CHECK (gewijzigd_via IN ('chat', 'interface')),
  veld_naam   text NOT NULL,
  oude_waarde text,
  nieuwe_waarde text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.location_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members lezen locatie-wijzigingen"
  ON public.location_changes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.tenant_id = location_changes.tenant_id
    )
  );

-- ─── Index op tenant_id voor audit-queries ───────────────────────────────────

CREATE INDEX IF NOT EXISTS location_changes_tenant_idx
  ON public.location_changes (tenant_id);

CREATE INDEX IF NOT EXISTS location_changes_location_idx
  ON public.location_changes (location_id);

-- ─── Verificatie ─────────────────────────────────────────────────────────────

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'locations'
ORDER BY ordinal_position;
