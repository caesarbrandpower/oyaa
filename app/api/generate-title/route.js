// app/api/generate-title/route.js
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { insertTokenUsage } from '@/lib/token-usage';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { threadId, content, outputType, outputTypeLabel } = await request.json();
  if (!threadId || !content?.trim()) {
    return Response.json({ error: 'threadId en content zijn verplicht.' }, { status: 400 });
  }

  // Verify thread ownership
  const { data: thread } = await supabase
    .from('threads')
    .select('id, tenant_id')
    .eq('id', threadId)
    .eq('user_id', user.id)
    .single();

  if (!thread) return Response.json({ error: 'Geen toegang.' }, { status: 403 });

  // Hardcoded labels — Haiku mag het type nooit zelf vertalen of samenvatten
  const TYPE_LABELS = {
    'account-to-pm':       'Briefing naar PM',
    'account-to-creation': 'Briefing naar Creatie',
    'field-briefing':      'Briefing naar BA',
    'meeting-summary':     'Samenvatting',
    'samenvatting':        'Samenvatting',
    'external-debrief':    'Evaluatie',
    'project-briefing':    'Projectbriefing',
    'account-pm-briefing': 'Briefing naar PM',
    'evaluation':          'Evaluatie',
  };
  const effectiveTypeLabel = TYPE_LABELS[outputType] || outputTypeLabel || 'Document';

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 40,
      messages: [{
        role: 'user',
        content: `Genereer een beknopte titel voor dit document. Format: "[Documenttype] — [klant of project]". Maximaal 6 woorden. Geef ALLEEN de titel terug, geen uitleg of aanhalingstekens.\n\nGebruik als documenttype EXACT dit label (niet vertalen, niet aanpassen): ${effectiveTypeLabel}\n\nInhoud (begin):\n${content.slice(0, 1200)}`,
      }],
    });

    insertTokenUsage({
      tenantId: thread.tenant_id ?? null,
      userId: user.id,
      threadId,
      requestType: 'generate-title',
      model: 'claude-haiku-4-5-20251001',
      usage: response.usage,
    });

    const title = response.content[0]?.text?.trim()
      .replace(/^["']|["']$/g, '')
      .replace(/→/g, 'naar')
      .replace(/[Oo]verdracht/g, 'Briefing');
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
