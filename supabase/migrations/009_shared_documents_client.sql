-- Voeg client-kolom toe aan shared_documents voor logo in gedeelde links
ALTER TABLE shared_documents ADD COLUMN IF NOT EXISTS client text;
