// app/api/rewrite-marker/route.js
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';

const client = new Anthropic();

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { paragraph, label, value, outputType } = await request.json();
  if (!paragraph?.trim() || !label?.trim() || !value?.trim()) {
    return Response.json({ error: 'paragraph, label en value zijn verplicht.' }, { status: 400 });
  }

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: `Je verwerkt een ingevulde waarde in een bestaande alinea. Schrijf de alinea natuurlijk herschreven in het Nederlands, met de waarde op de meest logische plek verwerkt. Schrijf altijd in bevestigende zin — nooit als vraag. De ingevulde informatie wordt als feit verwerkt in de lopende tekst. Behoud de toon en structuur. Verwijder alleen de specifiek genoemde markering; laat eventuele andere markeringen ongewijzigd. Geef alleen de herschreven alinea terug, niets anders.`,
    messages: [{
      role: 'user',
      content: `Alinea:\n${paragraph}\n\nMarkering: [${label}]\nIngevulde waarde: ${value}\n\nHerschrijf de alinea met de waarde verwerkt. Verwijder alleen [${label}]. Geef alleen de herschreven alinea terug.`,
    }],
  });

  const rewritten = resp.content[0]?.text?.trim();
  if (!rewritten) return Response.json({ error: 'Geen resultaat van Haiku.' }, { status: 500 });

  return Response.json({ rewritten });
}
