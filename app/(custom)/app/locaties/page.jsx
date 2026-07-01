// app/(custom)/app/locaties/page.jsx
import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { redirect } from 'next/navigation';
import LocationsPage from '@/components/custom/LocationsPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Locaties — Waybetter',
};

export default async function LocatiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tenant = await getTenant();
  if (!tenant?.tenant_config?.features?.locations) redirect('/app');

  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('naam', { ascending: true });

  return <LocationsPage tenant={tenant} locations={locations ?? []} />;
}
