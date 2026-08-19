-- supabase/migrations/036_locations_delete_policy.sql
-- Voegt DELETE-policy toe aan locations-tabel.
-- Zonder deze policy blokkeert RLS stille deletes (geen fout, 0 rijen verwijderd).

CREATE POLICY "Tenant members delete locations"
  ON public.locations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.tenant_id = locations.tenant_id
    )
  );
