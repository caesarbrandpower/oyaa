import { headers } from 'next/headers';
import { createServiceClient } from './supabase-server';

const DEFAULT_HOSTNAME = 'waybetter.nl';

/**
 * Haalt de tenant-config op voor de huidige request op basis van hostname.
 * Gebruikt de service role client (bypasses RLS).
 * Valt terug op waybetter.nl als de hostname niet gevonden wordt.
 *
 * @returns {Promise<Object|null>} Tenant record uit de tenants tabel
 */
export async function getTenant() {
  const headersList = await headers();
  const hostname = headersList.get('x-tenant-hostname') || DEFAULT_HOSTNAME;

  const supabase = createServiceClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('hostname', hostname)
    .single();

  if (tenant) return tenant;

  // Fallback: default tenant
  const { data: defaultTenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('hostname', DEFAULT_HOSTNAME)
    .single();

  return defaultTenant ?? null;
}
