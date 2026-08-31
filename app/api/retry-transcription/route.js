// Herstart de transcriptie voor een thread vanuit de opname in Storage.
// Werkt ook na 7 dagen (de Speechmatics-grens) omdat de audio in Supabase blijft.

import { createClient, createServiceClient } from '@/lib/supabase-server';
import { submitTranscriptionJob } from '@/lib/whisper';

export const maxDuration = 60;

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  let threadId;
  try {
    ({ threadId } = await request.json());
  } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  if (!threadId) return Response.json({ error: 'threadId ontbreekt.' }, { status: 400 });

  // Haal thread op via RLS (controleert eigenaarschap impliciet)
  const { data: thread, error: threadErr } = await supabase
    .from('threads')
    .select('id, audio_storage_path, tenant_id, transcript_status')
    .eq('id', threadId)
    .single();

  if (threadErr || !thread) {
    return Response.json({ error: 'Thread niet gevonden.' }, { status: 404 });
  }

  if (!thread.audio_storage_path) {
    return Response.json({ error: 'Geen opname-pad opgeslagen voor deze thread.' }, { status: 400 });
  }

  // Download audio vanuit Supabase Storage (via service-rol)
  const serviceClient = createServiceClient();
  const { data: audioBlob, error: downloadErr } = await serviceClient.storage
    .from('recordings')
    .download(thread.audio_storage_path);

  if (downloadErr || !audioBlob) {
    console.error('[retry-transcription] download mislukt:', downloadErr?.message);
    return Response.json({ error: 'Audio niet beschikbaar in Storage.' }, { status: 404 });
  }

  const audioBuffer = await audioBlob.arrayBuffer();

  // Zet status op 'queued' voordat we de job indienen
  await serviceClient
    .from('threads')
    .update({ transcript_status: 'queued', transcript_error: null, speechmatics_job_id: null })
    .eq('id', threadId);

  // Dien nieuwe Speechmatics-job in
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`;
  const callbackUrl = `${appUrl}/api/transcription-callback?thread_id=${threadId}`;

  try {
    const ext = thread.audio_storage_path.split('.').pop() || 'm4a';
    const jobId = await submitTranscriptionJob(
      audioBuffer,
      `recording.${ext}`,
      thread.tenant_id ?? null,
      callbackUrl,
    );

    await serviceClient
      .from('threads')
      .update({ speechmatics_job_id: jobId, transcript_status: 'processing' })
      .eq('id', threadId);

    console.log(`[retry-transcription] nieuwe job ${jobId} voor thread ${threadId}`);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[retry-transcription] job indienen mislukt:', err?.message ?? err);
    // Status staat al op 'queued' — cron pakt het op als storage_path er is maar geen job_id
    return Response.json({ error: 'Transcriptie-aanvraag mislukt. Probeer het later opnieuw.' }, { status: 502 });
  }
}
