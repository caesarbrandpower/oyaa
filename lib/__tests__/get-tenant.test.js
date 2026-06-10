import { describe, it, expect } from 'vitest';
import { resolveTenantHostname } from '../get-tenant';

describe('resolveTenantHostname', () => {
  it('gebruikt x-tenant-hostname als die er is', () => {
    expect(resolveTenantHostname('chase.waybetter.nl', 'iets-anders.nl')).toBe('chase.waybetter.nl');
  });

  it('valt terug op de host header als x-tenant-hostname ontbreekt (API-routes)', () => {
    expect(resolveTenantHostname(null, 'chase.waybetter.nl')).toBe('chase.waybetter.nl');
  });

  it('stript de poort van de host header (lokale dev)', () => {
    expect(resolveTenantHostname(null, 'localhost:3000')).toBe('localhost');
  });

  it('valt terug op de default hostname als beide ontbreken', () => {
    expect(resolveTenantHostname(null, null)).toBe('waybetter.nl');
  });
});
