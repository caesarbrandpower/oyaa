// lib/client-utils.js
// Gedeelde client-normalisatie logica — werkt in zowel server (route.js) als client ('use client') context

// ── Levenshtein afstand ────────────────────────────────────────────────────────
export function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
}

// ── Fuzzy match ────────────────────────────────────────────────────────────────
// knownClients: string[] — dynamisch opgehaald uit Supabase threads.client
// Retourneert:
//   { name, confirmed: true }  — exacte match (case-insensitive), gebruik direct
//   { name, confirmed: false, suggestion }  — typo gevonden, vraag bevestiging
//   null  — geen match gevonden (nieuwe klant)
export function fuzzyMatchClient(input, knownClients = []) {
  if (!input || !knownClients.length) return null;
  const inputLower = input.toLowerCase().trim();

  // Exacte match (case-insensitive)
  const exactMatch = knownClients.find(n => n.toLowerCase() === inputLower);
  if (exactMatch) return { name: exactMatch, confirmed: true };

  // Fuzzy match — max 25% van de lengte van de bekende naam
  for (const known of knownClients) {
    const distance = levenshtein(inputLower, known.toLowerCase());
    const threshold = Math.floor(known.length * 0.25);
    if (distance > 0 && distance <= threshold) {
      return { name: known, confirmed: false, suggestion: known };
    }
  }

  return null;
}
