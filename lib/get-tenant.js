import { headers } from 'next/headers';
import { createServiceClient } from './supabase-server';

const DEFAULT_HOSTNAME = 'waybetter.nl';

/**
 * Bepaalt de tenant-hostname voor de huidige request.
 * Pagina-requests krijgen x-tenant-hostname via de middleware. API-routes vallen
 * buiten de middleware matcher (api/ is uitgesloten) en gebruiken daarom de
 * host-header als fallback, met poort gestript voor lokale dev.
 */
export function resolveTenantHostname(xTenantHostname, host) {
  if (xTenantHostname) return xTenantHostname;
  if (host) return host.replace(/:\d+$/, '');
  return DEFAULT_HOSTNAME;
}

/**
 * Haalt de tenant-config op voor de huidige request op basis van hostname.
 * Gebruikt de service role client (bypasses RLS).
 * Valt terug op waybetter.nl als de hostname niet gevonden wordt.
 *
 * @returns {Promise<Object|null>} Tenant record uit de tenants tabel
 */
export async function getTenant() {
  const headersList = await headers();
  const hostname = resolveTenantHostname(
    headersList.get('x-tenant-hostname'),
    headersList.get('host')
  );

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
