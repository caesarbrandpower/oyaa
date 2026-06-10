// lib/vault/strip-contact-pii.js
// Stript alleen contact-PII (e-mail, telefoon, IBAN) voor embedding-input.
// Namen blijven bewust staan: die dragen de zoeksemantiek van de kluis.
// De ruwe tekst zelf wordt ongewijzigd opgeslagen in vault_chunks.content.

import { PATTERNS } from '../anonymize';

// IBAN bewust eerst: het telefoonpatroon matcht anders de cijferreeks
// binnen een IBAN en maakt die onherkenbaar voor de IBAN-pass.
const CONTACT_TYPES = ['IBAN', 'EMAIL', 'TELEFOON'];

export function stripContactPii(text) {
  let result = text;
  for (const type of CONTACT_TYPES) {
    const { regex } = PATTERNS.find((p) => p.type === type);
    result = result.replace(new RegExp(regex.source, regex.flags), `[${type.toLowerCase()}]`);
  }
  return result;
}
