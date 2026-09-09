// Maakt een recording-rij en thread aan nadat de client audio rechtstreeks
// naar Supabase Storage heeft geüpload via een pre-signed URL.
// Accepteert JSON { storagePath, ext?, client, project }.
// Haalt audio op van Storage om Speechmatics-job in te dienen.
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
  // Auth: Bearer (desktop-app) of cookie (browser)
  let user;
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearerToken) {
    const { data: { user: tokenUser }, error } = await createServiceClient().auth.getUser(bearerToken);
    if (error || !tokenUser) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });
    user = tokenUser;
  } else {
    const supabase = await createClient();
    const { data: { user: cookieUser } } = await supabase.auth.getUser();
    if (!cookieUser) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });
    user = cookieUser;
  }

  const db = createServiceClient();
  const tenant = await getTenant();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Ongeldig verzoek — verwacht JSON met storagePath.' }, { status: 400 });
  }

  const { storagePath, client: clientName = null, project = null } = body;

  if (!storagePath || typeof storagePath !== 'string') {
    return Response.json({ error: 'storagePath ontbreekt.' }, { status: 400 });
  }

  // ── 1. Public URL afleiden van storage path ────────────────────────────────
  const { data: { publicUrl: audioUrl } } = db.storage.from('recordings').getPublicUrl(storagePath);

  // ── 2. Recording-rij aanmaken ──────────────────────────────────────────────
  let recordingId = null;
  try {
    const ext = storagePath.split('.').pop() || 'm4a';
    const { data: rec, error: recErr } = await db
      .from('recordings')
      .insert({
        user_id: user.id,
        tenant_id: tenant?.id ?? null,
        storage_path: storagePath,
        audio_url: audioUrl,
        client: clientName || null,
        title: recordingTitle(clientName),
        transcript_status: 'queued',
      })
      .select('id')
      .single();
    if (recErr) {
      console.error('[create-recording-thread] recording insert mislukt:', recErr.message);
    } else {
      recordingId = rec.id;
    }
  } catch (e) {
    console.error('[create-recording-thread] recording insert exception:', e);
  }

  // ── 3. Thread aanmaken ─────────────────────────────────────────────────────
  const title = recordingTitle(clientName);
  const { data: thread, error: threadError } = await db
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
      recording_id: recordingId,
    })
    .select('id')
    .single();

  if (threadError) {
    console.error('[create-recording-thread] thread aanmaken mislukt:', threadError);
    return Response.json({ error: 'Thread aanmaken mislukt.' }, { status: 500 });
  }

  // ── 4. Speechmatics-job indienen (audio ophalen via Storage SDK) ─────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`;
  const callbackUrl = `${appUrl}/api/transcription-callback?thread_id=${thread.id}`;

  try {
    // SDK-download is betrouwbaarder dan fetch(publicUrl) — vermijdt 504's bij grote bestanden
    const { data: audioBlob, error: downloadErr } = await db.storage
      .from('recordings')
      .download(storagePath);
    if (downloadErr || !audioBlob) throw new Error(`Storage download mislukt: ${downloadErr?.message ?? 'geen data'}`);
    const audioBuffer = await audioBlob.arrayBuffer();

    const fileName = storagePath.split('/').pop() || 'recording.m4a';
    const jobId = await submitTranscriptionJob(
      audioBuffer,
      fileName,
      tenant?.id ?? null,
      callbackUrl,
    );

    await db
      .from('threads')
      .update({ speechmatics_job_id: jobId, transcript_status: 'processing' })
      .eq('id', thread.id);

    console.log(`[create-recording-thread] job ${jobId} ingediend voor thread ${thread.id}`);
  } catch (err) {
    console.error('[create-recording-thread] Speechmatics job mislukt:', err?.message ?? err);
    // Status op 'failed' zodat de gebruiker de retry-knop ziet — niet als 'queued' laten hangen
    // want de cron slaat threads zonder speechmatics_job_id over.
    await db
      .from('threads')
      .update({
        transcript_status: 'failed',
        transcript_error: 'Transcriptie-aanvraag mislukt. Gebruik de knop hieronder om het opnieuw te proberen.',
      })
      .eq('id', thread.id);
    if (recordingId) {
      await db
        .from('recordings')
        .update({ transcript_status: 'failed' })
        .eq('id', recordingId);
    }
  }

  return Response.json({ threadId: thread.id, title, audioUrl });
}
