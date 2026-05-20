const KNOWN_ABBREVIATIONS = new Set([
  'NS', 'KLM', 'AH', 'ANWB', 'ING', 'ABN', 'SNS', 'ASN', 'RTL',
  'NPO', 'NOS', 'SBS', 'VRT', 'BV', 'NV', 'VOF', 'HEMA', 'IKEA',
  'ALDI', 'LIDL', 'ASOS', 'BMW', 'VW', 'BP', 'AXA', 'TUI',
  'DHL', 'UPS', 'TNT', 'KPN', 'RB', 'HHZH', 'CBA', 'MCM', 'JDE',
]);

export function normalizeClientName(name, existingClients = []) {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const existing = existingClients.find((c) => c && c.toLowerCase() === lower);
  if (existing) return existing;
  return trimmed
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (KNOWN_ABBREVIATIONS.has(upper)) return upper;
      if (word.length <= 4 && word === word.toUpperCase() && /^[A-Z.]+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
