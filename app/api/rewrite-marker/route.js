// app/api/rewrite-marker/route.js
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { insertTokenUsage } from '@/lib/token-usage';

const client = new Anthropic();

// Volledige-document modus boven deze drempel is te duur/risicovol
const MAX_FULL_DOC_CHARS = 6000;

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { paragraph, label, value, outputType, fullDocument } = await request.json();
  if (!paragraph?.trim() || !label?.trim() || !value?.trim()) {
    return Response.json({ error: 'paragraph, label en value zijn verplicht.' }, { status: 400 });
  }

  const useFullDoc = !!(fullDocument && fullDocument.length <= MAX_FULL_DOC_CHARS);

  let systemPrompt, userMessage, maxTokens;

  if (useFullDoc) {
    systemPrompt = `Je verwerkt een ingevulde waarde in een briefingdocument. Schrijf altijd in het Nederlands, in bevestigende zin, nooit als vraag.

STAP 1 — VERWERK DE MARKERING: Herschrijf de alinea die [${label}] bevat met de ingevulde waarde op de meest logische plek verwerkt. Als de ingevulde waarde bestaande tekst in de alinea bevestigt, corrigeert of vervangt, overschrijf dan de tegenstrijdige of verouderde tekst — voeg niet toe naast tekst die dan klopt niet meer. Behoud toon en structuur. Verwijder alleen [${label}].

STAP 2 — RESTERENDE DEELVRAGEN: Bevat [${label}] meerdere deelvragen gescheiden door komma's, en beantwoordt de ingevulde waarde niet alle deelvragen? Voeg dan een nieuwe markering met de resterende onbeantwoorde vragen toe in de herschreven alinea.
Voorbeeld: [UITZOEKEN INTERN: naam contactpersoon, telefoonnummer, beschikbaarheid] + "Jan de Vries" → herschreven alinea eindigt met [UITZOEKEN INTERN: telefoonnummer, beschikbaarheid].

STAP 3 — PROPAGEER NAAR DOCUMENT: Scan het volledige document. Zijn er maximaal 1-2 andere alinea's waar diezelfde specifieke informatie ook direct relevant is (bijv. dezelfde locatie die elders ontbreekt of een contradictie veroorzaakt)? Pas alleen die alinea's aan — alles overig blijft EXACT ongewijzigd.

Geef je antwoord als geldig JSON in precies dit formaat, niets anders:
{"rewritten":"...herschreven alinea...","otherUpdates":[{"original":"exacte originele alineatekst","updated":"herschreven versie"}]}
Als er geen aanverwante alinea's zijn: {"rewritten":"...","otherUpdates":[]}`;

    userMessage = `Volledig document:\n${fullDocument}\n\n---\n\nAlinea met markering:\n${paragraph}\n\nMarkering: [${label}]\nIngevulde waarde: ${value}\n\nRetourneer het JSON-object.`;
    maxTokens = 2000;
  } else {
    systemPrompt = `Je verwerkt een ingevulde waarde in een bestaande alinea. Schrijf de alinea natuurlijk herschreven in het Nederlands, met de waarde op de meest logische plek verwerkt. Als de ingevulde waarde bestaande tekst bevestigt, corrigeert of vervangt, overschrijf dan de tegenstrijdige of verouderde tekst in de alinea. Schrijf altijd in bevestigende zin — nooit als vraag. Behoud de toon en structuur. Verwijder alleen de specifiek genoemde markering; laat eventuele andere markeringen ongewijzigd.

MEERDERE DEELVRAGEN: Bevat de markering meerdere deelvragen (gescheiden door komma's na de dubbele punt), en beantwoordt de ingevulde waarde niet alle deelvragen? Voeg dan een nieuwe markering toe met de resterende onbeantwoorde vragen in de herschreven alinea.
Voorbeeld: [UITZOEKEN INTERN: naam contactpersoon, telefoonnummer, beschikbaarheid] + "Jan de Vries" → "...Jan de Vries... [UITZOEKEN INTERN: telefoonnummer, beschikbaarheid]"

Geef alleen de herschreven alinea terug, niets anders.`;

    userMessage = `Alinea:\n${paragraph}\n\nMarkering: [${label}]\nIngevulde waarde: ${value}\n\nHerschrijf de alinea met de waarde verwerkt. Verwijder alleen [${label}]. Geef alleen de herschreven alinea terug.`;
    maxTokens = 800;
  }

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  insertTokenUsage({
    tenantId: null,
    userId: user.id,
    threadId: null,
    requestType: 'rewrite-marker',
    model: 'claude-haiku-4-5-20251001',
    usage: resp.usage,
  });

  const rawText = resp.content[0]?.text?.trim();
  if (!rawText) return Response.json({ error: 'Geen resultaat van Haiku.' }, { status: 500 });

  if (useFullDoc) {
    try {
      // Strip markdown code blocks als Haiku die toch meestuurt
      const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(jsonText);
      const rewritten = parsed.rewritten?.trim();
      if (!rewritten) throw new Error('rewritten leeg');
      const otherUpdates = Array.isArray(parsed.otherUpdates) ? parsed.otherUpdates : [];
      return Response.json({ rewritten, otherUpdates });
    } catch {
      // Fallback: behandel de volledige tekst als herschreven alinea
      return Response.json({ rewritten: rawText, otherUpdates: [] });
    }
  }

  return Response.json({ rewritten: rawText, otherUpdates: [] });
}
