// Speechmatics stuurt hier een POST zodra een batch-job klaar is.
// De thread_id staat als query-parameter in de callback-URL.
// Het transcript (JSON-v2 formaat) zit in de request body.

import { createServiceClient } from '@/lib/supabase-server';
import { processTranscriptJson } from '@/lib/whisper';
import { saveTranscript } from '@/lib/save-transcript';

export const maxDuration = 30;
export const fetchCache = 'force-no-store';

export async function POST(request) {
  // ── Verificeer webhook-authenticatie ────────────────────────────────────
  const auth = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.SPEECHMATICS_WEBHOOK_SECRET}`;
  if (!process.env.SPEECHMATICS_WEBHOOK_SECRET || auth !== expected) {
    console.warn('[transcription-callback] ongeautoriseerd verzoek afgewezen');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Haal thread_id op uit de URL ─────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get('thread_id');
  if (!threadId) {
    return Response.json({ error: 'thread_id ontbreekt' }, { status: 400 });
  }

  // ── Parseer het transcript ────────────────────────────────────────────────
  let transcriptJson;
  try {
    transcriptJson = await request.json();
  } catch {
    return Response.json({ error: 'Ongeldig JSON-body' }, { status: 400 });
  }

  const transcript = processTranscriptJson(transcriptJson);

  if (!transcript) {
    console.warn(`[transcription-callback] leeg transcript voor thread ${threadId}`);
    const supabase = createServiceClient();
    await supabase
      .from('threads')
      .update({ transcript_status: 'failed', transcript_error: 'Leeg transcript ontvangen van Speechmatics.' })
      .eq('id', threadId)
      .in('transcript_status', ['queued', 'processing']);
    return Response.json({ ok: true });
  }

  await saveTranscript(threadId, transcript);
  return Response.json({ ok: true });
}
