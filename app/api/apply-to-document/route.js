// app/api/apply-to-document/route.js
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { insertTokenUsage } from '@/lib/token-usage';

const client = new Anthropic();

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { freeText, fullDocument, outputType, markings } = await request.json();
  if (!freeText?.trim() || !fullDocument?.trim()) {
    return Response.json({ error: 'freeText en fullDocument zijn verplicht.' }, { status: 400 });
  }

  const markingsList = Array.isArray(markings) && markings.length > 0
    ? markings.map((m, i) => `${i + 1}. [${m}]`).join('\n')
    : '(geen markeringen gevonden)';

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: `Je verwerkt vrije tekst van een gebruiker in een briefingdocument. Schrijf altijd in het Nederlands, in bevestigende zin, nooit als vraag.

TAAK: Gegeven de vrije tekst van de gebruiker, bepaal welke markeringen in het document door deze informatie beantwoord of aangevuld kunnen worden. Herschrijf alleen die alinea's — alles overig blijft EXACT ongewijzigd.

REGELS:
- Verwerk de informatie alleen waar die inhoudelijk relevant is voor de markering
- Als een markering meerdere deelvragen bevat en de tekst beantwoordt er maar één, voeg een nieuwe markering toe met de resterende onbeantwoorde vragen
- Verzin nooit informatie — verwerk alleen wat de gebruiker letterlijk aanlevert
- Als de tekst voor geen enkele markering relevant is, geef een lege array terug

Geef je antwoord als geldig JSON in precies dit formaat, niets anders:
[{"original":"exacte originele alineatekst","updated":"herschreven versie"}]
Als niets van toepassing is: []`,
    messages: [{
      role: 'user',
      content: `Vrije tekst van gebruiker:\n"${freeText.trim()}"\n\nOpenstaande markeringen in het document:\n${markingsList}\n\nVolledig document:\n${fullDocument}\n\nRetourneer het JSON-array.`,
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
