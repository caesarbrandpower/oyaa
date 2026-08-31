// Speechmatics stuurt hier een POST zodra een batch-job klaar is.
// De thread_id staat als query-parameter in de callback-URL.
// Het transcript (JSON-v2 formaat) zit in de request body.

import { createServiceClient } from '@/lib/supabase-server';
import { processTranscriptJson } from '@/lib/whisper';
import { saveTranscript } from '@/lib/save-transcript';

export const maxDuration = 30;
export const fetchCache = 'force-no-store';

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get('thread_id');

  // ── Log elke binnenkomende aanroep voor diagnose ──────────────────────────
  const auth = request.headers.get('authorization') ?? '(geen)';
  console.log(`[transcription-callback] POST ontvangen — thread_id=${threadId}, auth-header=${auth.slice(0, 40)}...`);

  // ── Verificeer webhook-authenticatie ─────────────────────────────────────
  const webhookSecret = process.env.SPEECHMATICS_WEBHOOK_SECRET;
  if (webhookSecret) {
    const expected = `Bearer ${webhookSecret}`;
    if (auth !== expected) {
      console.warn('[transcription-callback] auth-header klopt niet — verzoek afgewezen');
      console.warn(`  ontvangen: ${auth.slice(0, 60)}`);
      console.warn(`  verwacht:  Bearer ${webhookSecret.slice(0, 8)}...`);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[transcription-callback] SPEECHMATICS_WEBHOOK_SECRET niet ingesteld — auth overgeslagen');
  }

  if (!threadId) {
    return Response.json({ error: 'thread_id ontbreekt' }, { status: 400 });
  }

  // ── Parseer het transcript ────────────────────────────────────────────────
  let transcriptJson;
  try {
    transcriptJson = await request.json();
  } catch {
    console.error('[transcription-callback] JSON parseren mislukt');
    return Response.json({ error: 'Ongeldig JSON-body' }, { status: 400 });
  }

  // Log de top-level sleutels zodat we de body-structuur kunnen zien
  console.log('[transcription-callback] body sleutels:', Object.keys(transcriptJson ?? {}));
  console.log('[transcription-callback] results.length:', transcriptJson?.results?.length ?? 'geen results-sleutel');

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
