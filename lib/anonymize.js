const PATTERNS = [
  { type: 'EMAIL',    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g },
  { type: 'TELEFOON', regex: /(\+31|0031|0)[1-9][0-9\s\-]{7,}/g },
  { type: 'IBAN',     regex: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7,19}\b/g },
  { type: 'BEDRAG',   regex: /€\s?[0-9]+([.,][0-9]{1,3})*(\s?(k|K|miljoen))?|\b[0-9]+([.,][0-9]{3})*\s?(euro|EUR)\b/g },
  { type: 'NAAM',     regex: /\b([A-Z][a-zéèëàâîïôûù]+ [A-Z][a-zéèëàâîïôûù]+)\b/g },
  { type: 'BEDRIJF',  regex: /\b([A-Z][a-zA-Z\s&]{2,25}(BV|NV|VOF|B\.V\.|N\.V\.)?)\b/g },
];

export function anonymize(text) {
  const map = {};
  const counters = {};
  let result = text;

  for (const { type, regex } of PATTERNS) {
    result = result.replace(new RegExp(regex.source, regex.flags), (match) => {
      const existing = Object.entries(map).find(([, v]) => v === match);
      if (existing) return existing[0];
      counters[type] = (counters[type] || 0) + 1;
      const token = `[${type}_${counters[type]}]`;
      map[token] = match;
      return token;
    });
  }

  return { anonymized: result, map };
}

export function deanonymize(text, map) {
  let result = text;
  for (const [token, original] of Object.entries(map)) {
    result = result.split(token).join(original);
  }
  return result;
}
