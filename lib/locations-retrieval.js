export const LOCATION_TOOL_SCHEMA = {
  name: 'search_locations',
  description: 'Zoek locaties op in de database. Gebruik dit voor ALLE vragen over locaties: adres, kosten, bereik, CPM, parkeren, laden en lossen, vergunning, doelgroep, bijzonderheden, vergelijkingen en alternatieven. Roep deze tool aan zodra een vraag over een specifieke locatie of een set locaties gaat, ongeacht welk veld er gevraagd wordt.',
  input_schema: {
    type: 'object',
    properties: {
      naam_bevat: {
        type: 'string',
        description: 'Zoekt op substring in de naam (hoofdletterongevoelig). Gebruik voor stadsnamen (bijv. "Rotterdam") of locatienamen.',
      },
      channel: {
        type: 'string',
        description: 'Exact channel-filter: "Station", "Winkelcentrum", "Luchthaven", etc.',
      },
      bereik_min: { type: 'number', description: 'Minimaal dagbereik (inclusief).' },
      bereik_max: { type: 'number', description: 'Maximaal dagbereik (inclusief).' },
      prijs_max:  { type: 'number', description: 'Maximale huurprijs in euro (inclusief).' },
      sortering: {
        type: 'string',
        enum: ['cpm_asc', 'cpm_desc', 'bereik_desc', 'bereik_asc', 'prijs_asc', 'naam_asc'],
        description: 'Sorteervolgorde. cpm_asc = laagste CPM eerst (meest efficiënt).',
      },
      vergelijkbaar_met: {
        type: 'string',
        description: 'Deel van een locatienaam (substring, hoofdletterongevoelig). De server matcht alle locaties waarvan de naam deze substring bevat, berekent het gemiddeld bereik en geeft locaties terug binnen factor-3-venster, gesorteerd op CPM oplopend. Gebruik dit voor vergelijkingsvragen.',
      },
      bereik_ontbreekt: {
        type: 'boolean',
        description: 'Wanneer true: geeft alleen locaties terug waarvoor geen bereikgegeven bekend is. Gebruik dit voor vragen als "welke locaties hebben nog geen bereik?".',
      },
      doelgroep: {
        type: 'string',
        description: 'Filter op doelgroep. Gebruik dit voor vragen als "welke locaties bereiken studenten / gezinnen / forensen?". Geldige waarden: Forensen, Studenten, Gezinnen, Shoppers, Toeristen, Werkenden, Breed publiek.',
      },
      leeftijdsgroep: {
        type: 'string',
        description: 'Filter op leeftijdsgroep. Geldige waarden: 18-25, 18-35, 25-45, 30-45, 45+, Alle leeftijden. Geeft alleen locaties terug waarvan de leeftijdsgroep-lijst deze waarde bevat.',
      },
      limiet: {
        type: 'integer',
        description: 'Maximum aantal resultaten (default: 25). Gebruik 100 voor volledigheidsqueries zoals "welke locaties..." zonder andere filters.',
      },
    },
  },
};

/**
 * Voert een search_locations tool-call uit namens het model.
 * Geeft een markdown-tabel terug die het model als tool-resultaat ontvangt.
 * Telefoon, email en website worden NOOIT opgehaald of teruggegeven (AVG).
 */
export async function executeLocationTool(params, supabase, tenantId) {
  try {
    const {
      naam_bevat,
      channel,
      bereik_min,
      bereik_max,
      prijs_max,
      sortering = 'naam_asc',
      vergelijkbaar_met,
      bereik_ontbreekt = false,
      doelgroep,
      leeftijdsgroep,
      limiet = 25,
    } = params;

    // Haal alle locaties op voor dit tenant (we filteren in JS voor eenvoud en
    // omdat de dataset klein genoeg is: < 200 rijen per tenant).
    let { data: locs, error } = await supabase
      .from('locations')
      .select('naam, stad, channel, bereik, bereik_note, prijs, prijssoort, status, bron, omschrijving, adres, doelgroep, leeftijdsgroep, parkeren, laden_lossen, vergunning_status, vergunning_vervaldatum, bijzonderheden')
      .eq('tenant_id', tenantId)
      .order('naam');

    // Migratie 035 kan nog niet zijn uitgevoerd — val terug zonder leeftijdsgroep.
    if (error?.message?.includes('leeftijdsgroep')) {
      ({ data: locs, error } = await supabase
        .from('locations')
        .select('naam, stad, channel, bereik, bereik_note, prijs, prijssoort, status, bron, omschrijving, adres, doelgroep, parkeren, laden_lossen, vergunning_status, vergunning_vervaldatum, bijzonderheden')
        .eq('tenant_id', tenantId)
        .order('naam'));
    }

    if (error || !locs?.length) {
      return { text: 'Geen locaties gevonden.', locations: [] };
    }

    let results = locs;

    // vergelijkbaar_met: server-side drempelberekening, NIET door het model
    if (vergelijkbaar_met) {
      const refNaam = vergelijkbaar_met.toLowerCase();
      const refs = locs.filter(l => l.naam.toLowerCase().includes(refNaam));
      if (refs.length > 0) {
        const refValues = refs.map(r => r.bereik).filter(v => v != null && v > 0);
        if (refValues.length > 0) {
          const refAvg = Math.round(refValues.reduce((a, b) => a + b, 0) / refValues.length);
          const min = Math.round(refAvg / 3);
          const max = Math.round(refAvg * 3);
          const refNamen = new Set(refs.map(r => r.naam));
          results = locs.filter(l => {
            if (refNamen.has(l.naam)) return false;
            return l.bereik != null && l.bereik >= min && l.bereik <= max;
          });
          const refInfo = `Referentie: ${refs.map(r => r.naam).join(', ')} — gemiddeld bereik ${refAvg.toLocaleString('nl-NL')}\nBereikvenster: ${min.toLocaleString('nl-NL')}–${max.toLocaleString('nl-NL')} (factor 3)\n\n`;
          results = sortLocations(results, 'cpm_asc');
          const sliced = results.slice(0, limiet);
          return {
            text: refInfo + formatLocationTable(sliced),
            locations: sliced.map(l => ({ naam: l.naam, stad: l.stad ?? null, channel: l.channel ?? null })),
          };
        }
      }
      return { text: `Referentielocatie "${vergelijkbaar_met}" niet gevonden.`, locations: [] };
    }

    // Overige filters
    if (bereik_ontbreekt) {
      results = results.filter(l => l.bereik == null);
    }
    if (naam_bevat) {
      const q = naam_bevat.toLowerCase();
      results = results.filter(l => l.naam.toLowerCase().includes(q));
    }
    if (channel) {
      results = results.filter(l => l.channel?.toLowerCase() === channel.toLowerCase());
    }
    if (bereik_min != null) results = results.filter(l => l.bereik != null && l.bereik >= bereik_min);
    if (bereik_max != null) results = results.filter(l => l.bereik != null && l.bereik <= bereik_max);
    if (prijs_max != null) results = results.filter(l => l.prijs != null && l.prijs <= prijs_max);
    if (doelgroep) results = results.filter(l => Array.isArray(l.doelgroep) && l.doelgroep.includes(doelgroep));
    if (leeftijdsgroep) results = results.filter(l => Array.isArray(l.leeftijdsgroep) && l.leeftijdsgroep.includes(leeftijdsgroep));

    results = sortLocations(results, sortering);

    if (!results.length) return { text: 'Geen locaties gevonden met deze filters.', locations: [] };

    const sliced = results.slice(0, limiet);
    return {
      text: formatLocationTable(sliced),
      locations: sliced.map(l => ({ naam: l.naam, stad: l.stad ?? null, channel: l.channel ?? null })),
    };
  } catch {
    return { text: 'Tool-uitvoering mislukt.', locations: [] };
  }
}

function sortLocations(locs, sortering) {
  return [...locs].sort((a, b) => {
    const cpmA = a.bereik > 0 && a.prijs != null && a.prijssoort === 'huurprijs' ? a.prijs / a.bereik : Infinity;
    const cpmB = b.bereik > 0 && b.prijs != null && b.prijssoort === 'huurprijs' ? b.prijs / b.bereik : Infinity;
    switch (sortering) {
      case 'cpm_asc':     return cpmA - cpmB;
      case 'cpm_desc':    return cpmB - cpmA;
      case 'bereik_desc': return (b.bereik ?? 0) - (a.bereik ?? 0);
      case 'bereik_asc':  return (a.bereik ?? 0) - (b.bereik ?? 0);
      case 'prijs_asc':   return (a.prijs ?? Infinity) - (b.prijs ?? Infinity);
      default:            return a.naam.localeCompare(b.naam, 'nl');
    }
  });
}

function formatLocationTable(locs) {
  if (!locs.length) return 'Geen resultaten.';
  const header = '[Alle getallen zijn zonder tijdseenheid — schrijf nooit /dag, per dag, /week, per week of /maand]\nnaam | bereik | kosten | cpm | status';
  const rows = locs.map(l => {
    const bereik = l.bereik != null ? Number(l.bereik).toLocaleString('nl-NL') : '-';
    let kosten = '-';
    if (l.prijs != null && l.prijssoort) kosten = `€${Number(l.prijs).toLocaleString('nl-NL')} ${l.prijssoort}`;
    else if (l.prijs != null) kosten = `€${Number(l.prijs).toLocaleString('nl-NL')}`;
    let cpm = '-';
    if (l.bereik > 0 && l.prijs != null && l.prijssoort === 'huurprijs') {
      cpm = `€${Math.ceil(l.prijs / l.bereik * 1000)}`;
    }
    return [l.naam, bereik, kosten, cpm, l.status ?? 'onbekend'].join(' | ');
  });
  return [header, '---', ...rows].join('\n');
}

/**
 * Stripped index zonder bereik/kosten/cpm — alleen voor contexten waar tool-use
 * actief is. Geeft het model een volledig beeld van welke locaties bestaan en
 * waar ze liggen, maar verwijdert alle numerieke kolommen.
 */
export function buildLocationNameIndex(locations) {
  if (!locations?.length) return '';
  const header = 'naam | stad | channel | status';
  const rows = locations.map(l =>
    [l.naam, l.stad ?? '-', l.channel ?? '-', l.status ?? 'onbekend'].join(' | ')
  );
  return [header, '---', ...rows].join('\n');
}

/**
 * Bouwt een dunne namen-index (geen getallen) als Layer 1 context.
 * Wordt meegegeven als system-prompt suffix zodat het model weet welke
 * locaties bestaan. Kosten en bereik komen via de search_locations tool.
 */
export async function buildLocationNameContext(tenant, supabase) {
  const locationsOn = tenant?.tenant_config?.features?.locations === true;
  if (!locationsOn) return '';

  const { data: locs } = await supabase
    .from('locations')
    .select('naam, stad, channel, status')
    .eq('tenant_id', tenant.id)
    .order('naam');

  if (!locs?.length) return '';

  const tenantLabel = tenant?.name ?? 'dit bureau';
  const index = buildLocationNameIndex(locs);
  return `## Locatieoverzicht (${tenantLabel})\nOnderstaand alle locaties op naam. Gebruik search_locations voor bereik, kosten, CPM en vergelijkingen — de namen hieronder bevatten geen cijfers. Bij vergelijkingsvragen: gebruik vergelijkbaar_met (bijv. "Utrecht Centraal" matcht automatisch alle varianten). CPM = kosten per 1.000 bereik; lager is efficiënter. Schrijf bereik- en kostengetallen altijd zonder tijdseenheid: niet "154.795/dag", maar gewoon "154.795".\n\n${index}`;
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

  if (Array.isArray(location.doelgroep) && location.doelgroep.length) lines.push(`Doelgroep: ${location.doelgroep.join(', ')}`);
  if (Array.isArray(location.leeftijdsgroep) && location.leeftijdsgroep.length) lines.push(`Leeftijdsgroep: ${location.leeftijdsgroep.join(', ')}`);
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
