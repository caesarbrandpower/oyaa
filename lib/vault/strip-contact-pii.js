// lib/vault/strip-contact-pii.js
// Stript alleen contact-PII (e-mail, telefoon, IBAN) voor embedding-input.
// Namen blijven bewust staan: die dragen de zoeksemantiek van de kluis.
// De ruwe tekst zelf wordt ongewijzigd opgeslagen in vault_chunks.content.

import { PATTERNS } from '../anonymize';

const CONTACT_TYPES = new Set(['EMAIL', 'TELEFOON', 'IBAN']);

export function stripContactPii(text) {
  let result = text;
  for (const { type, regex } of PATTERNS) {
    if (!CONTACT_TYPES.has(type)) continue;
    result = result.replace(new RegExp(regex.source, regex.flags), `[${type.toLowerCase()}]`);
  }
  return result;
}
