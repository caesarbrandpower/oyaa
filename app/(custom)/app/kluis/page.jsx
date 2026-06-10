// app/(custom)/app/kluis/page.jsx
import { createClient, createServiceClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { redirect } from 'next/navigation';
import VaultPage from '@/components/custom/VaultPage';
import { isVaultAdmin, vaultEnabled } from '@/lib/vault/access';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Kluis — Waybetter',
};

export default async function KluisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tenant = await getTenant();

  // Kluis alleen voor tenants waar de vlag aan staat
  if (!vaultEnabled(tenant)) redirect('/app');

  // Admin-bypass: beheerder kijkt via de service role in elke tenant-kluis,
  // met expliciet tenant-filter. Gewone gebruikers gaan via RLS (user_tenants).
  const db = isVaultAdmin(user) ? createServiceClient() : supabase;
  const { data: documents } = await db
    .from('vault_documents')
    .select('id, title, source_type, output_type, client, project, created_at')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return <VaultPage tenant={tenant} documents={documents ?? []} />;
}
