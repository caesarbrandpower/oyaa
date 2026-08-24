// Accepteert een audio-blob, upload naar Storage, maakt een thread aan met
// transcript_status='queued', en dient een Speechmatics-job in op de achtergrond.
// Geeft direct { threadId, title, audioUrl } terug — geen wachten op transcript.
export const maxDuration = 120;

import { createClient, createServiceClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { submitTranscriptionJob } from '@/lib/whisper';

function pad(n) {
  return String(n).padStart(2, '0');
}

function recordingTitle(client) {
  const now = new Date();
  const date = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
  return client
    ? `Meeting transcript — ${client} — ${date}`
    : `Meeting transcript — ${date}`;
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const tenant = await getTenant();

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  const audioFile = formData.get('audio');
  if (!audioFile) return Response.json({ error: 'Geen audiobestand.' }, { status: 400 });

  const clientName = formData.get('client') || null;
  const project = formData.get('project') || null;

  // ── 1. Upload audio naar Storage ──────────────────────────────────────────
  const ext = audioFile.name?.split('.').pop() || 'm4a';
  const storagePath = `${user.id}/${Date.now()}.${ext}`;
  const audioBuffer = await audioFile.arrayBuffer();

  const serviceClient = createServiceClient();
  const { data: storageData, error: storageError } = await serviceClient.storage
    .from('recordings')
    .upload(storagePath, audioBuffer, {
      contentType: audioFile.type || 'audio/m4a',
      upsert: false,
    });

  if (storageError || !storageData) {
    console.error('[create-recording-thread] storage upload mislukt:', storageError);
    return Response.json({ error: 'Audio opslaan mislukt.' }, { status: 500 });
  }

  const { data: { publicUrl: audioUrl } } = serviceClient.storage
    .from('recordings')
    .getPublicUrl(storagePath);

  // ── 2. Thread aanmaken met status 'queued' ────────────────────────────────
  const title = recordingTitle(clientName);
  const { data: thread, error: threadError } = await supabase
    .from('threads')
    .insert({
      user_id: user.id,
      tenant_id: tenant?.id ?? null,
      title,
      output_type: 'recording',
      client: clientName || null,
      project: project || null,
      audio_url: audioUrl,
      audio_storage_path: storagePath,
      transcript_status: 'queued',
    })
    .select('id')
    .single();

  if (threadError) {
    console.error('[create-recording-thread] thread aanmaken mislukt:', threadError);
    return Response.json({ error: 'Thread aanmaken mislukt.' }, { status: 500 });
  }

  // ── 3. Speechmatics-job indienen ──────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`;
  const callbackUrl = `${appUrl}/api/transcription-callback?thread_id=${thread.id}`;

  try {
    const jobId = await submitTranscriptionJob(
      audioBuffer,
      audioFile.name || `recording.${ext}`,
      tenant?.id ?? null,
      callbackUrl,
    );

    await supabase
      .from('threads')
      .update({ speechmatics_job_id: jobId, transcript_status: 'processing' })
      .eq('id', thread.id);

    console.log(`[create-recording-thread] job ${jobId} ingediend voor thread ${thread.id}`);
  } catch (err) {
    // Job indienen mislukt — status blijft 'queued', cron kan opnieuw proberen
    console.error('[create-recording-thread] Speechmatics job mislukt:', err?.message ?? err);
  }

  return Response.json({ threadId: thread.id, title, audioUrl });
}
