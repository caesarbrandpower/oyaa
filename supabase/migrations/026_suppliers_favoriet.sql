-- supabase/migrations/026_suppliers_favoriet.sql
-- Vervangt beoordeling door een eenvoudig favoriet-systeem.

-- Wis bestaande beoordelingswaarden
UPDATE public.suppliers SET beoordeling = NULL;

-- Voeg favoriet kolom toe
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS favoriet boolean NOT NULL DEFAULT false;

-- Verificatie
SELECT naam, beoordeling, favoriet FROM public.suppliers ORDER BY naam;
