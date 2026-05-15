// app/api/generate-title/route.js
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { threadId, content, outputType } = await request.json();
  if (!threadId || !content?.trim()) {
    return Response.json({ error: 'threadId en content zijn verplicht.' }, { status: 400 });
  }

  // Verify thread ownership
  const { data: thread } = await supabase
    .from('threads')
    .select('id')
    .eq('id', threadId)
    .eq('user_id', user.id)
    .single();

  if (!thread) return Response.json({ error: 'Geen toegang.' }, { status: 403 });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 40,
      messages: [{
        role: 'user',
        content: `Genereer een beknopte titel voor dit document. Maximaal 6 woorden, format: "[documenttype] — [klant of project]". Geef alleen de titel terug, geen uitleg of aanhalingstekens.\n\nDocumenttype: ${outputType ?? 'document'}\n\nInhoud (begin):\n${content.slice(0, 1200)}`,
      }],
    });

    const title = response.content[0]?.text?.trim().replace(/^["']|["']$/g, '');
    if (!title) return Response.json({ title: null });

    await supabase
      .from('threads')
      .update({ title })
      .eq('id', threadId);

    return Response.json({ title });
  } catch (err) {
    console.error('generate-title error:', err);
    return Response.json({ title: null });
  }
}
