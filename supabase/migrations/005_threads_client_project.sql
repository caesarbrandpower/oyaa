-- supabase/migrations/005_threads_client_project.sql
-- Voeg client en project kolommen toe aan threads voor mappenstructuur in docs-archief

alter table public.threads add column if not exists client text;
alter table public.threads add column if not exists project text;
