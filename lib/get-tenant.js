import { headers } from 'next/headers';
import { createServiceClient } from './supabase-server';

const DEFAULT_HOSTNAME = 'waybetter.nl';

// Bouwt tenant_config.features op vanuit de oude structuur als backward-compat laag.
// Zodra de DB-migratie (020) voor alle tenants gedraaid is en de cleanup-stap
// is uitgevoerd, kan deze functie worden verwijderd.
function normalizeTenantFeatures(tenant) {
  if (!tenant) return tenant;
  const config = tenant.tenant_config ?? {};
  if (config.features) return tenant;

  const rawTypes = Array.isArray(tenant.enabled_output_types)
    ? tenant.enabled_output_types
    : [];
  const outputTypeIds = rawTypes
    .map(t => (typeof t === 'object' ? t?.id : t))
    .filter(Boolean);

  return {
    ...tenant,
    tenant_config: {
      ...config,
      features: {
        free_chat: true,
        vault: config.vault_enabled === true,
        locations: false,
        suppliers: false,
        recording: true,
        output_types: outputTypeIds,
      },
    },
  };
}

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

  if (tenant) return normalizeTenantFeatures(tenant);

  // Fallback: default tenant
  console.warn(`[getTenant] Onbekende hostname "${hostname}" — valt terug op default tenant (${DEFAULT_HOSTNAME}). Controleer of de hostname correct is geconfigureerd.`);
  const { data: defaultTenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('hostname', DEFAULT_HOSTNAME)
    .single();

  return normalizeTenantFeatures(defaultTenant ?? null);
}
