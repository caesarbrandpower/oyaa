-- 035_doelgroep_array.sql
-- Zet doelgroep om van text naar text[] en voeg leeftijdsgroep text[] toe.
-- Alle bestaande waarden zijn null, dus USING-expressie is puur voor type-safety.

ALTER TABLE locations
  ALTER COLUMN doelgroep TYPE text[] USING CASE WHEN doelgroep IS NULL THEN NULL ELSE ARRAY[doelgroep] END,
  ADD COLUMN IF NOT EXISTS leeftijdsgroep text[];
