/**
 * Bouwt een compacte index-tabel van alle locaties voor layer 1 van de chat-context.
 * CPM wordt alleen berekend voor huurprijs-records; vergunningskosten zijn niet vergelijkbaar.
 */
export function buildLocationIndex(locations) {
  if (!locations?.length) return '';

  const header = 'naam | stad | channel | bereik | kosten | cpm | status';
  const separator = '---';

  const rows = locations.map(l => {
    const bereik = l.bereik != null ? Number(l.bereik).toLocaleString('nl-NL') : '-';
    let kosten = '-';
    if (l.prijs != null && l.prijssoort) {
      kosten = `€${Number(l.prijs).toLocaleString('nl-NL')} ${l.prijssoort}`;
    } else if (l.prijs != null) {
      kosten = `€${Number(l.prijs).toLocaleString('nl-NL')}`;
    }

    let cpm = '-';
    if (l.bereik > 0 && l.prijs != null && l.prijssoort === 'huurprijs') {
      cpm = `€${Math.ceil(l.prijs / l.bereik * 1000)}`;
    }

    return [l.naam, l.stad ?? '-', l.channel ?? '-', bereik, kosten, cpm, l.status ?? 'onbekend'].join(' | ');
  });

  return [header, separator, ...rows].join('\n');
}

/**
 * Detecteert welke locaties bij naam worden vermeld in het bericht.
 * Twee strategieën:
 * 1. Volledige naam als substring van het bericht (bestaand gedrag).
 * 2. Prefix-match: bericht bevat een meerdere-woorden prefix van de naam.
 *    Hierdoor matcht "Amsterdam Centraal" op "Amsterdam Centraal (Cuypershal)",
 *    "Amsterdam Centraal IJhal Oost" etc., en "Utrecht Centraal" op beide varianten.
 *    Vereist: naam heeft ≥ 3 woorden, prefix minimaal 2 woorden en 6 tekens.
 */
export function detectMentionedLocations(message, locations) {
  if (!message || !locations?.length) return [];
  const lower = message.toLowerCase();
  return locations.filter(l => {
    const naam = l.naam.toLowerCase();
    if (lower.includes(naam)) return true;
    const words = naam.split(/\s+/);
    if (words.length >= 3) {
      for (let end = words.length - 1; end >= 2; end--) {
        const prefix = words.slice(0, end).join(' ');
        if (prefix.length >= 6 && lower.includes(prefix)) return true;
      }
    }
    return false;
  });
}

const COMPARE_SIGNAL_RE = /\b(goedkoper|duurder|alternatief|alternatieven|vergelijk(?:en|baar)?|andere\s+opties?|soortgelijk|in\s+plaats\s+van|beter\s+dan|slechter\s+dan|kosteneffici[eë]nt(?:er)?|voordeliger)\b/i;

export function hasCompareSignal(message) {
  return COMPARE_SIGNAL_RE.test(message ?? '');
}

/**
 * Generieke vergelijkingsfunctie — bruikbaar voor elke entiteitenset met een numeriek veld.
 *
 * Generaliseren naar andere entiteiten (bijv. leveranciers):
 *   - numericField: het veld om de drempel op te berekenen (bijv. 'levertijd' in dagen)
 *   - scoreField + scoreDir: het veld om op te sorteren en de richting ('asc'/'desc')
 *   - threshold: ruim houden (3-4); liever te veel kandidaten dan een gemiste optie
 *
 * @param {object[]} entities        Alle entiteiten (locaties, leveranciers, ...)
 * @param {object[]} references      Referentie-entiteiten (de genoemde locaties)
 * @param {string}   numericField    Veld voor drempelberekening (bijv. 'bereik')
 * @param {number}   threshold       Factor rondom het referentiegemiddelde (default 3)
 * @returns {{ candidates: object[], refAvg: number, min: number, max: number }}
 */
export function findComparableCandidates(entities, references, numericField, threshold = 3) {
  const refValues = references.map(r => r[numericField]).filter(v => v != null && v > 0);
  if (refValues.length === 0) return { candidates: [], refAvg: 0, min: 0, max: 0 };

  const refAvg = Math.round(refValues.reduce((a, b) => a + b, 0) / refValues.length);
  const min = Math.round(refAvg / threshold);
  const max = Math.round(refAvg * threshold);
  const refNamen = new Set(references.map(r => r.naam));

  const candidates = entities.filter(e => {
    if (refNamen.has(e.naam)) return false;
    const val = e[numericField];
    return val != null && val >= min && val <= max;
  });

  return { candidates, refAvg, min, max };
}

/**
 * Formatteert een volledig detailblok voor een locatie.
 * Slaat telefoon, email en website ALTIJD over (AVG + niet relevant voor chat).
 */
export function formatLocationDetail(location) {
  const lines = [`### ${location.naam}`];

  if (location.omschrijving) lines.push(`Omschrijving: ${location.omschrijving}`);
  if (location.adres)        lines.push(`Adres: ${location.adres}`);

  // Bereik en prijs altijd expliciet in het detailblok — model hoeft Layer 1 niet te scannen
  if (location.bereik != null) {
    lines.push(`Bereik/dag: ${Number(location.bereik).toLocaleString('nl-NL')}`);
  }
  if (location.bereik_note) lines.push(`Bereik-toelichting: ${location.bereik_note}`);
  if (location.prijs != null && location.prijssoort) {
    lines.push(`Kosten: €${Number(location.prijs).toLocaleString('nl-NL')} ${location.prijssoort}`);
  } else if (location.prijs != null) {
    lines.push(`Kosten: €${Number(location.prijs).toLocaleString('nl-NL')}`);
  }
  if (location.bereik > 0 && location.prijs != null && location.prijssoort === 'huurprijs') {
    lines.push(`CPM: €${Math.ceil(location.prijs / location.bereik * 1000)}`);
  }

  if (location.doelgroep)    lines.push(`Doelgroep: ${location.doelgroep}`);
  if (location.parkeren)     lines.push(`Parkeren: ${location.parkeren}`);
  if (location.laden_lossen) lines.push(`Laden en lossen: ${location.laden_lossen}`);

  if (location.vergunning_status) {
    const vd = location.vergunning_vervaldatum
      ? ` (geldig t/m ${location.vergunning_vervaldatum})`
      : '';
    lines.push(`Vergunning: ${location.vergunning_status}${vd}`);
  }

  if (location.bijzonderheden) lines.push(`Bijzonderheden: ${location.bijzonderheden}`);

  if (location.status === 'onbekend' && location.bron?.includes('Ninox-import')) {
    lines.push(`Let op: status onbekend — dit gegeven is afkomstig uit de Ninox-import en is nog niet recent bevestigd.`);
  }

  return lines.join('\n');
}

/**
 * Hoofdfunctie voor de chat-route: bouwt de volledige database-contextsuffix.
 * Laag 1: altijd, compacte index van alle locaties.
 * Laag 2: uitgebreid detail voor locaties die in het bericht worden genoemd.
 * Telefoon gaat nooit mee in een Anthropic-payload.
 */
export async function buildDatabaseContext(tenant, supabase, userMessage) {
  const locationsOn = tenant?.tenant_config?.features?.locations === true;
  const suppliersOn = tenant?.tenant_config?.features?.suppliers === true;

  if (!locationsOn && !suppliersOn) return { contextText: '', mentionedLocations: [] };

  const [locResult, supResult] = await Promise.all([
    locationsOn
      ? supabase
          .from('locations')
          .select('naam, stad, channel, bereik, bereik_note, prijs, prijssoort, status, bron, omschrijving, doelgroep, adres, parkeren, laden_lossen, vergunning_status, vergunning_vervaldatum, bijzonderheden')
          .eq('tenant_id', tenant.id)
          .order('naam')
      : Promise.resolve({ data: null }),
    suppliersOn
      ? supabase
          .from('suppliers')
          .select('naam, omschrijving, categorie, regio, levertijd, prijsindicatie, contactpersoon, bijzonderheden')
          .eq('tenant_id', tenant.id)
          .order('naam')
      : Promise.resolve({ data: null }),
  ]);

  const tenantLabel = tenant?.name ?? 'dit bureau';
  const sections = [];
  let mentionedLocations = [];

  if (locationsOn && locResult.data?.length > 0) {
    const locs = locResult.data;
    const mentioned = detectMentionedLocations(userMessage ?? '', locs);
    mentionedLocations = mentioned;

    // Pre-compute Layer 3 before building Layer 1, zodat de Layer 1-header
    // een expliciete verwijzing kan bevatten als de vergelijkingstabel aanwezig is.
    let layer3Block = '';
    if (mentioned.length > 0 && hasCompareSignal(userMessage)) {
      const { candidates, refAvg, min, max } = findComparableCandidates(locs, mentioned, 'bereik', 3);

      if (candidates.length > 0) {
        const sorted = [...candidates].sort((a, b) => {
          const cpmA = a.bereik > 0 && a.prijs != null && a.prijssoort === 'huurprijs' ? a.prijs / a.bereik : Infinity;
          const cpmB = b.bereik > 0 && b.prijs != null && b.prijssoort === 'huurprijs' ? b.prijs / b.bereik : Infinity;
          return cpmA - cpmB;
        });

        const refNamen = mentioned.map(l => l.naam).join(', ');
        const rows = sorted.map(l => {
          const bereikStr = Number(l.bereik).toLocaleString('nl-NL');
          const kosten = l.prijs != null && l.prijssoort
            ? `€${Number(l.prijs).toLocaleString('nl-NL')} ${l.prijssoort}`
            : l.prijs != null ? `€${Number(l.prijs).toLocaleString('nl-NL')}` : '-';
          const cpm = l.bereik > 0 && l.prijs != null && l.prijssoort === 'huurprijs'
            ? `€${Math.ceil(l.prijs / l.bereik * 1000)}`
            : '-';
          return [l.naam, bereikStr, kosten, cpm].join(' | ');
        });

        layer3Block = `\n\n## Vergelijkingstabel (server-side bepaald — ${sorted.length} kandidaten)
Referentie: ${refNamen} — gemiddeld bereik ${refAvg.toLocaleString('nl-NL')}
Bereikdrempel: ${min.toLocaleString('nl-NL')}–${max.toLocaleString('nl-NL')} (factor 3 rondom referentiegemiddelde).
CPM = kosten per 1.000 bereik. Lager is efficiënter (goedkoper per contact). Gesorteerd: laagste CPM eerst.
INSTRUCTIE: gebruik UITSLUITEND deze tabel voor je antwoord op vergelijkingsvragen. Raadpleeg de hoofdtabel hieronder NIET voor vergelijkingen — stad, kanaal of andere kolommen zijn geen selectiecriterium.

naam | bereik | kosten | cpm
---
${rows.join('\n')}`;
      } else if (refAvg > 0) {
        layer3Block = `\n\n## Vergelijkingstabel (server-side bepaald — 0 kandidaten)
Referentie: ${mentioned.map(l => l.naam).join(', ')} — gemiddeld bereik ${refAvg.toLocaleString('nl-NL')}
Bereikdrempel: ${min.toLocaleString('nl-NL')}–${max.toLocaleString('nl-NL')} (factor 3). Geen andere locaties vallen binnen dit bereik.`;
      }
    }

    const totaal = locs.length;
    const metBereik = locs.filter(l => l.bereik != null).length;
    const zonderBereik = locs.filter(l => l.bereik == null);
    const zonderBereikLijst = zonderBereik.map(l => l.naam).join(', ');

    const statistieken = `Statistieken (server-side berekend — gebruik uitsluitend deze cijfers voor aantallen, tel de tabel nooit zelf):
- Totaal locaties: ${totaal}
- Met bereikwaarde: ${metBereik}
- Zonder bereikwaarde (${zonderBereik.length}): ${zonderBereikLijst}`;

    const vergelijkingsNoot = layer3Block
      ? '\nVERGELIJKINGSVRAGEN: zie de Vergelijkingstabel verderop in deze context — gebruik de onderstaande tabel NIET als bron voor vergelijkingen.'
      : '';

    const index = buildLocationIndex(locs);
    let block = `## Locatiedatabase (${tenantLabel})\nBereikcijfers zijn daggemiddelden op basis van jaarschattingen — gebruik ze als indicatie, niet als meting.\nCPM = kosten per 1.000 bereik; lager is efficiënter. CPM is alleen berekend voor huurprijzen.\nKosten: een vast bedrag per activatie. Er is geen periode in de data — voeg nooit een tijdseenheid toe.${vergelijkingsNoot}\n\n${statistieken}\n\n${index}`;

    if (mentioned.length > 0) {
      const details = mentioned.map(formatLocationDetail).join('\n\n');
      block += `\n\n## Detail gevraagde locaties (${mentioned.length})\n${details}`;
    }

    block += layer3Block;

    sections.push(block);
  }

  if (suppliersOn && supResult.data?.length > 0) {
    sections.push(`## Leveranciersdatabase\nDe volgende leveranciers zijn beschikbaar voor ${tenantLabel}:\n${JSON.stringify(supResult.data, null, 2)}`);
  }

  return { contextText: sections.join('\n\n'), mentionedLocations };
}
