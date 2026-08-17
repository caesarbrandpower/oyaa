export const CHAT_UPDATABLE_FIELDS = [
  'bijzonderheden',
  'parkeren',
  'laden_lossen',
  'vergunning_status',
  'bereik',
  'bereik_note',
  'prijs',
  'prijssoort',
  'status',
  'adres',
  'omschrijving',
  'doelgroep',
  'channel',
  'stad',
];

const WRITE_INTENT_RE = /\b(zet|pas|wijzig|update|stel\s+in|noteer|verander)\b.{0,60}\b(bij|aan|voor|naar|in|dat)\b|\b(leg\s+vast|sla\s+op|voeg\s+toe|bewaar|schrijf\s+op)\b/i;

export function hasWriteIntent(message) {
  return WRITE_INTENT_RE.test(message);
}

/**
 * Vraagt Haiku om de locatienaam, het veld en de nieuwe waarde te extraheren.
 * Retourneert null als de extractie mislukt of het veld niet in de whitelist staat.
 */
export async function parseWriteIntent(message, locationNames, anthropicClient) {
  const namenLijst = locationNames.join(', ');

  let resp;
  try {
    resp = await anthropicClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Bekende locatienamen: ${namenLijst}

Bericht: "${message}"

Geef ALLEEN een JSON-object zonder uitleg:
{
  "locatie_naam": "<exacte naam uit de lijst hierboven, of null>",
  "veld": "<een van: bijzonderheden, parkeren, laden_lossen, vergunning_status, bereik, bereik_note, prijs, prijssoort, status, adres, omschrijving, doelgroep, channel, stad>",
  "nieuwe_waarde": "<de nieuwe waarde als tekst>",
  "modus": "<aanvullen, vervangen of verwijder>"
}

Regels voor modus:
- Standaard is altijd "aanvullen", voor elk veld.
- Gebruik "vervangen" ALLEEN als het bericht een van deze exacte signalen bevat: "vervang", "verander naar", "stel in op".
- Gebruik "verwijder" als het bericht aangeeft dat iets weggehaald moet worden.
- Bij twijfel: "aanvullen". Weggooien is onherstelbaar.

Regels voor nieuwe_waarde:
- Formuleer als een korte, complete zin. Geen losse fragmenten.
- "Zet bij X dat opbouw voortaan voor 07:30 moet" → nieuwe_waarde: "Opbouw voortaan voor 07:30."
- Eerste letter hoofdletter, afsluitende punt.
- Bij modus "verwijder": nieuwe_waarde is het fragment dat verwijderd moet worden.

Als de locatienaam niet in de lijst staat of het bericht geen schrijf-intentie bevat: {"locatie_naam": null, "veld": null, "nieuwe_waarde": null, "modus": null}`,
      }],
    });
  } catch {
    return null;
  }

  let parsed;
  try {
    const text = resp.content[0]?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    return null;
  }

  if (!parsed?.locatie_naam || !parsed?.veld) return null;
  if (!CHAT_UPDATABLE_FIELDS.includes(parsed.veld)) return null;

  return {
    locatieNaam: parsed.locatie_naam,
    veld: parsed.veld,
    nieuweWaarde: parsed.nieuwe_waarde ?? '',
    modus: ['vervangen', 'verwijder'].includes(parsed.modus) ? parsed.modus : 'aanvullen',
  };
}
