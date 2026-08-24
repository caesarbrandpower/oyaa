// Vergelijkingstool: zelfde audio door Speechmatics EN OpenAI Whisper.
// Niet voor productie — bedoeld voor één handmatige kwaliteitsvergelijking.
// Aanroep: POST /api/compare-transcription met multipart/form-data, field "audio".
export const maxDuration = 300;

import { createClient } from '@/lib/supabase-server';
import { transcribeAudio, transcribeAudioOpenAI } from '@/lib/whisper';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  let file;
  try {
    const formData = await request.formData();
    file = formData.get('audio');
  } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  if (!file) return Response.json({ error: 'Geen audiobestand.' }, { status: 400 });

  // Draai beide tegelijk
  const [speechmaticsResult, openaiResult] = await Promise.allSettled([
    transcribeAudio(file),
    (async () => {
      // Maak een kopie van de file want de stream kan maar één keer gelezen worden
      const buf = await file.arrayBuffer();
      const copy = new File([buf], file.name || 'recording.m4a', { type: file.type });
      return transcribeAudioOpenAI(copy);
    })(),
  ]);

  return Response.json({
    speechmatics: speechmaticsResult.status === 'fulfilled'
      ? { ok: true, transcript: speechmaticsResult.value }
      : { ok: false, error: String(speechmaticsResult.reason) },
    openai: openaiResult.status === 'fulfilled'
      ? { ok: true, transcript: openaiResult.value }
      : { ok: false, error: String(openaiResult.reason) },
  });
}
