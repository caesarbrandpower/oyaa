// lib/vault/access.js
// Toegangsregels voor de kluis: wie is beheerder, en voor welke tenant
// staat de kluis aan. De vlag stuurt al het kluisgedrag aan (UI, upload,
// retrieval, auto-ingest); zonder vlag doet de kluis voor die tenant niets.

const ADMIN_EMAILS = ['caesar@newfound.agency'];

export function isVaultAdmin(user) {
  const email = user?.email?.toLowerCase();
  return !!email && ADMIN_EMAILS.includes(email);
}

export function vaultEnabled(tenant) {
  return tenant?.tenant_config?.vault_enabled === true;
}
