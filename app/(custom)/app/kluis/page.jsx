// app/(custom)/app/kluis/page.jsx
import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { redirect } from 'next/navigation';
import VaultPage from '@/components/custom/VaultPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Kluis — Waybetter',
};

export default async function KluisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tenant = await getTenant();

  // RLS filtert op tenant-lidmaatschap (user_tenants); bewust geen user_id-filter,
  // de kluis is gedeelde kennis van het hele bureau
  const { data: documents } = await supabase
    .from('vault_documents')
    .select('id, title, source_type, output_type, client, project, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  return <VaultPage tenant={tenant} documents={documents ?? []} />;
}
