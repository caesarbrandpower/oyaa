/**
 * Bouwt een compacte index-tabel van alle locaties voor layer 1 van de chat-context.
 * CPM wordt alleen berekend voor huurprijs-records; vergunningskosten zijn niet vergelijkbaar.
 */
export function buildLocationIndex(locations) {
  if (!locations?.length) return '';

  const header = 'naam | stad | channel | bereik | prijs | prijssoort | cpm | status';
  const separator = '---';

  const rows = locations.map(l => {
    const bereik = l.bereik != null ? Number(l.bereik).toLocaleString('nl-NL') : '-';
    // Alleen huurprijs toont €-teken; vergunningskosten en andere types zijn niet direct vergelijkbaar
    const prijs  = l.prijs != null
      ? (l.prijssoort === 'huurprijs' ? `€${Number(l.prijs).toLocaleString('nl-NL')}` : Number(l.prijs).toLocaleString('nl-NL'))
      : '-';
    const ps     = l.prijssoort ?? '-';

    let cpm = '-';
    if (l.bereik > 0 && l.prijs != null && l.prijssoort === 'huurprijs') {
      cpm = `€${Math.ceil(l.prijs / l.bereik * 1000)}`;
    }

    return [l.naam, l.stad ?? '-', l.channel ?? '-', bereik, prijs, ps, cpm, l.status ?? 'onbekend'].join(' | ');
  });

  return [header, separator, ...rows].join('\n');
}

/**
 * Detecteert welke locaties bij naam worden vermeld in het bericht.
 * Eenvoudige substring-match, geen fuzzy.
 */
export function detectMentionedLocations(message, locations) {
  if (!message || !locations?.length) return [];
  const lower = message.toLowerCase();
  return locations.filter(l => lower.includes(l.naam.toLowerCase()));
}

/**
 * Formatteert een volledig detailblok voor een locatie.
 * Slaat telefoon, email en website ALTIJD over (AVG + niet relevant voor chat).
 */
export function formatLocationDetail(location) {
  const lines = [`### ${location.naam}`];

  if (location.omschrijving) lines.push(`Omschrijving: ${location.omschrijving}`);
  if (location.adres)        lines.push(`Adres: ${location.adres}`);
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
  if (location.bereik_note)    lines.push(`Bereik-toelichting: ${location.bereik_note}`);

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
    const index = buildLocationIndex(locs);
    const mentioned = detectMentionedLocations(userMessage ?? '', locs);
    mentionedLocations = mentioned;

    let block = `## Locatiedatabase (${tenantLabel})\nBereikcijfers zijn daggemiddelden op basis van jaarschattingen — gebruik ze als indicatie, niet als meting. CPM is alleen berekend voor huurprijzen.\nPrijs is een vast bedrag per activatie. Voeg nooit een tijdseenheid toe (geen "/week", "/dag" of andere periode) — die staat niet in de data.\nToon prijssoort exact zoals die in de data staat: "huurprijs" of "vergunningskosten". Niets anders.\nDoe geen uitspraken over aantallen locaties of gelijke waarden die niet direct uit de onderstaande tabel volgen — tel zelf als je een aantal noemt.\n\n${index}`;

    if (mentioned.length > 0) {
      const details = mentioned.map(formatLocationDetail).join('\n\n');
      block += `\n\n## Detail gevraagde locaties\n${details}`;
    }

    sections.push(block);
  }

  if (suppliersOn && supResult.data?.length > 0) {
    sections.push(`## Leveranciersdatabase\nDe volgende leveranciers zijn beschikbaar voor ${tenantLabel}:\n${JSON.stringify(supResult.data, null, 2)}`);
  }

  return { contextText: sections.join('\n\n'), mentionedLocations };
}
