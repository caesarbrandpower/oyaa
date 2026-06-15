// app/api/apply-to-document/route.js
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { insertTokenUsage } from '@/lib/token-usage';

const client = new Anthropic();

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { freeText, fullDocument, outputType, markings, fileContent } = await request.json();
  if (!fullDocument?.trim()) {
    return Response.json({ error: 'fullDocument is verplicht.' }, { status: 400 });
  }
  if (!freeText?.trim() && !fileContent?.trim()) {
    return Response.json({ error: 'freeText of fileContent is verplicht.' }, { status: 400 });
  }

  const markingsList = Array.isArray(markings) && markings.length > 0
    ? markings.map((m, i) => `${i + 1}. [${m}]`).join('\n')
    : '(geen markeringen gevonden)';

  const fileSection = fileContent?.trim()
    ? `\n\nBijgevoegd bestand van gebruiker:\n${fileContent.trim()}`
    : '';

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: `Je verwerkt informatie van een gebruiker in een briefingdocument. Schrijf altijd in het Nederlands, in bevestigende zin, nooit als vraag.

TAAK: Bepaal welke markeringen in het document door deze informatie beantwoord of aangevuld kunnen worden. Herschrijf alleen die alinea's — alles overig blijft EXACT ongewijzigd.

REGELS:
- Verwerk de informatie alleen waar die inhoudelijk relevant is voor de markering
- Als de gebruiker bestaande informatie bevestigt, corrigeert of bijwerkt, VERVANG dan de tegenstrijdige of verouderde tekst door de nieuwe versie — voeg niet toe naast bestaande tekst die dan klopt
- MARKERING VERWIJDEREN: als een markering volledig beantwoord is, verwijder dan de volledige [LABEL] inclusief blokhaken uit de herschreven alinea — vervang hem door de verwerkte tekst, geen blokhaken
- Als een markering meerdere deelvragen bevat en de tekst beantwoordt er maar één, voeg een nieuwe markering toe met ALLEEN de resterende onbeantwoorde vragen in blokhaken: [LABEL: resterende vragen]
- Verzin nooit informatie — verwerk alleen wat de gebruiker letterlijk aanlevert
- Als de tekst voor geen enkele markering relevant is, geef een lege array terug

Geef je antwoord als geldig JSON in precies dit formaat, niets anders:
[{"original":"exacte originele alineatekst","updated":"herschreven versie"}]
Als niets van toepassing is: []`,
    messages: [{
      role: 'user',
      content: `Informatie van gebruiker:\n"${(freeText || '').trim()}"${fileSection}\n\nOpenstaande markeringen in het document:\n${markingsList}\n\nVolledig document:\n${fullDocument}\n\nRetourneer het JSON-array.`,
    }],
  });

  insertTokenUsage({
    tenantId: null,
    userId: user.id,
    threadId: null,
    requestType: 'apply-to-document',
    model: 'claude-haiku-4-5-20251001',
    usage: resp.usage,
  });

  const rawText = resp.content[0]?.text?.trim();
  if (!rawText) return Response.json({ updates: [] });

  try {
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(jsonText);
    const updates = Array.isArray(parsed) ? parsed : [];
    return Response.json({ updates });
  } catch {
    return Response.json({ updates: [] });
  }
}
