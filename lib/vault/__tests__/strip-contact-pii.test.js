import { describe, it, expect } from 'vitest';
import { stripContactPii } from '../strip-contact-pii';

describe('stripContactPii', () => {
  it('stript e-mailadressen', () => {
    expect(stripContactPii('Mail naar jan@chase.amsterdam voor info'))
      .toBe('Mail naar [email] voor info');
  });

  it('stript telefoonnummers', () => {
    expect(stripContactPii('Hotline: 06-12345678')).toBe('Hotline: [telefoon]');
  });

  it('stript IBANs', () => {
    expect(stripContactPii('Rekening NL91ABNA0417164300 gebruiken'))
      .toBe('Rekening [iban] gebruiken');
  });

  it('laat persoons- en merknamen staan', () => {
    const text = 'Jan Jansen deed de sampling voor Coca-Cola en Red Bull';
    expect(stripContactPii(text)).toBe(text);
  });
});
