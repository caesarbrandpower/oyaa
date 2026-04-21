import Anthropic from '@anthropic-ai/sdk';
import { anonymize, deanonymize } from '@/lib/anonymize';
import { PROMPTS } from '@/lib/prompts';

export async function POST(request) {
  const { transcript, outputType, projectId, recipient } = await request.json();

  if (!transcript || !transcript.trim()) {
    return Response.json({ error: 'Transcript is verplicht.' }, { status: 400 });
  }

  if (!outputType || !PROMPTS[outputType]) {
    return Response.json({ error: 'Ongeldig outputType.' }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const trimmed = transcript.trim();
    const { anonymized, map } = anonymize(trimmed);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: PROMPTS[outputType](anonymized, recipient),
        },
      ],
    });

    const rawOutput = message.content[0].text;
    const finalOutput = deanonymize(rawOutput, map);

    // Save to database only if projectId is provided and Supabase is configured
    if (projectId && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your_supabase_url') {
      try {
        const { createClient } = await import('@/lib/supabase-server');
        const supabase = await createClient();
        await supabase.from('outputs').insert({
          project_id: projectId,
          output_type: outputType,
          input_transcript: trimmed,
          result: finalOutput,
        });
      } catch (dbError) {
        console.error('Database save error (non-fatal):', dbError);
      }
    }

    return Response.json({ result: finalOutput });
  } catch (error) {
    console.error('Anthropic API error:', error);
    return Response.json(
      { error: 'Er is een fout opgetreden bij het verwerken van je verzoek.' },
      { status: 500 }
    );
  }
}
