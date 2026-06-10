-- supabase/migrations/014_rls_token_usage_feedback.sql
-- Enable RLS for consistency with all other tables.
-- Both tables are only accessed via service_role client (admin routes),
-- which bypasses RLS. No policies needed for current access patterns.
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
