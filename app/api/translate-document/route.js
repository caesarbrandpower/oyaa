// app/api/translate-document/route.js
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';

export const maxDuration = 60;

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  const { content } = body;
  if (!content?.trim()) return Response.json({ error: 'Content is verplicht.' }, { status: 400 });

  const prompt = `Translate this document fully to English. Preserve the exact markdown formatting, structure, and sections. Also translate the label names (e.g. **Datum:** → **Date:**, **Aanwezig:** → **Present:**, **Type gesprek:** → **Type of meeting:**, **Klant/opdrachtgever:** → **Client:**, **Projectfase** → **Project phase**, etc.). Output ONLY the translated document, without any introduction or explanation.\n\nDocument:\n\n${content}`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      messages: [{ role: 'user', content: prompt }],
    });

    const translated = response.content[0]?.text?.trim() ?? '';
    if (!translated) return Response.json({ error: 'Vertaling mislukt.' }, { status: 500 });
    return Response.json({ content: translated });
  } catch (err) {
    console.error('[translate-document]', err?.message ?? err);
    return Response.json({ error: 'Vertaling mislukt.' }, { status: 500 });
  }
}
