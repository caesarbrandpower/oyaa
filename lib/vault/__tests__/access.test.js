import { describe, it, expect } from 'vitest';
import { isVaultAdmin, vaultEnabled } from '../access';

describe('isVaultAdmin', () => {
  it('herkent het admin-account, ongeacht hoofdletters', () => {
    expect(isVaultAdmin({ email: 'caesar@newfound.agency' })).toBe(true);
    expect(isVaultAdmin({ email: 'Caesar@Newfound.Agency' })).toBe(true);
  });

  it('wijst andere accounts en lege input af', () => {
    expect(isVaultAdmin({ email: 'mike@chase.amsterdam' })).toBe(false);
    expect(isVaultAdmin({})).toBe(false);
    expect(isVaultAdmin(null)).toBe(false);
  });
});

describe('vaultEnabled', () => {
  it('is alleen true bij een expliciete vault_enabled true in tenant_config', () => {
    expect(vaultEnabled({ tenant_config: { vault_enabled: true } })).toBe(true);
    expect(vaultEnabled({ tenant_config: { vault_enabled: 'true' } })).toBe(false);
    expect(vaultEnabled({ tenant_config: {} })).toBe(false);
    expect(vaultEnabled({})).toBe(false);
    expect(vaultEnabled(null)).toBe(false);
  });
});
