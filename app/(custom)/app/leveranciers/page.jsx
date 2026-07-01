import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { redirect } from 'next/navigation';
import SuppliersPage from '@/components/custom/SuppliersPage';

export const dynamic = 'force-dynamic';

export default async function LeveranciersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tenant = await getTenant();
  if (!tenant?.tenant_config?.features?.suppliers) redirect('/app');

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('naam', { ascending: true });

  return <SuppliersPage tenant={tenant} suppliers={suppliers ?? []} />;
}
