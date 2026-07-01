-- supabase/migrations/027_location_favorites.sql
-- Per-gebruiker favorieten voor locaties (junction tabel).

CREATE TABLE IF NOT EXISTS public.location_favorites (
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, location_id)
);

ALTER TABLE public.location_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gebruiker ziet eigen locatie-favorieten"
  ON public.location_favorites FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Gebruiker voegt eigen locatie-favorieten toe"
  ON public.location_favorites FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Gebruiker verwijdert eigen locatie-favorieten"
  ON public.location_favorites FOR DELETE
  USING (user_id = auth.uid());

-- Verificatie
SELECT count(*) AS rijen FROM public.location_favorites;
