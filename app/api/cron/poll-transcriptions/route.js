// Cron-fallback: haalt openstaande Speechmatics-jobs op als de webhook niet aankwam,
// en herindient jobs die nooit zijn ingediend (bijv. na een Storage-fout bij upload).
// Draait elke 5 minuten via Vercel cron (zie vercel.json).

import { createServiceClient } from '@/lib/supabase-server';
import { processTranscriptJson, submitTranscriptionJob } from '@/lib/whisper';
import { saveTranscript } from '@/lib/save-transcript';

const EU_ENDPOINT = 'https://eu1.asr.api.speechmatics.com';

export const maxDuration = 60;
export const fetchCache = 'force-no-store';

export async function GET(request) {
  // Vercel voegt automatisch Authorization: Bearer <CRON_SECRET> toe
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.SPEECHMATICS_API_KEY;
  if (!apiKey) return Response.json({ error: 'API key ontbreekt' }, { status: 500 });

  const supabase = createServiceClient();

  // Threads die in de afgelopen 7 dagen zijn aangemaakt en nog niet klaar zijn
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: threads, error } = await supabase
    .from('threads')
    .select('id, speechmatics_job_id, transcript_status, audio_storage_path, tenant_id')
    .in('transcript_status', ['queued', 'processing'])
    .not('speechmatics_job_id', 'is', null)
    .gt('created_at', cutoff);

  if (error) {
    console.error('[poll-transcriptions] Supabase-fout:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!threads?.length) {
    return Response.json({ ok: true, checked: 0, processed: 0 });
  }

  let processed = 0;
  let failed = 0;

  for (const thread of threads) {
    try {
      const jobId = thread.speechmatics_job_id;

      // Check job-status bij Speechmatics
      const statusRes = await fetch(`${EU_ENDPOINT}/v2/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!statusRes.ok) {
        const body = await statusRes.text();
        console.warn(`[poll-transcriptions] job ${jobId} status-check mislukt: ${statusRes.status} ${body}`);
        continue;
      }

      const { job } = await statusRes.json();

      if (job.status === 'done') {
        // Haal transcript op
        const transcriptRes = await fetch(
          `${EU_ENDPOINT}/v2/jobs/${jobId}/transcript?format=json-v2`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );

        if (!transcriptRes.ok) {
          console.warn(`[poll-transcriptions] transcript ophalen mislukt voor job ${jobId}: ${transcriptRes.status}`);
          continue;
        }

        const transcriptJson = await transcriptRes.json();
        const transcript = processTranscriptJson(transcriptJson);

        if (!transcript) {
          await supabase
            .from('threads')
            .update({ transcript_status: 'failed', transcript_error: 'Leeg transcript van Speechmatics.' })
            .eq('id', thread.id)
            .in('transcript_status', ['queued', 'processing']);
          failed++;
          continue;
        }

        await saveTranscript(thread.id, transcript);
        processed++;
      } else if (job.status === 'rejected') {
        await supabase
          .from('threads')
          .update({
            transcript_status: 'failed',
            transcript_error: `Speechmatics verwierp de job: ${JSON.stringify(job.errors ?? [])}`,
          })
          .eq('id', thread.id)
          .in('transcript_status', ['queued', 'processing']);
        failed++;
      }
      // 'running' → nog bezig, volgende cron-run pakt het op
    } catch (err) {
      console.error(`[poll-transcriptions] fout bij thread ${thread.id}:`, err?.message ?? err);
    }
  }

  console.log(`[poll-transcriptions] ${threads.length} gecontroleerd, ${processed} verwerkt, ${failed} mislukt`);

  // ── Herindienen: threads zonder speechmatics_job_id aangemaakt in de laatste 2 uur ──
  // Dit vangt Storage-fouten op die de initiële jobsubmit blokkeerden.
  // Tijdgrens van 2 uur = 24 cron-pogingen; daarna blijft de thread op 'failed'
  // en moet de gebruiker handmatig opnieuw proberen.
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: unsubmitted, error: unsubErr } = await supabase
    .from('threads')
    .select('id, audio_storage_path, tenant_id, transcript_status')
    .in('transcript_status', ['queued', 'failed'])
    .is('speechmatics_job_id', null)
    .not('audio_storage_path', 'is', null)
    .gt('created_at', twoHoursAgo);

  if (unsubErr) {
    console.error('[poll-transcriptions] fout bij ophalen niet-ingediende threads:', unsubErr.message);
  }

  let resubmitted = 0;
  for (const thread of (unsubmitted ?? [])) {
    try {
      const { data: audioBlob, error: dlErr } = await supabase.storage
        .from('recordings')
        .download(thread.audio_storage_path);
      if (dlErr || !audioBlob) {
        console.warn(`[poll-transcriptions] audio download mislukt voor thread ${thread.id}:`, dlErr?.message);
        continue;
      }
      const audioBuffer = await audioBlob.arrayBuffer();
      const ext = thread.audio_storage_path.split('.').pop() || 'm4a';
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) { console.warn('[poll-transcriptions] NEXT_PUBLIC_APP_URL ontbreekt, skip'); continue; }
      const callbackUrl = `${appUrl}/api/transcription-callback?thread_id=${thread.id}`;
      const jobId = await submitTranscriptionJob(audioBuffer, `recording.${ext}`, thread.tenant_id ?? null, callbackUrl);
      await supabase
        .from('threads')
        .update({ speechmatics_job_id: jobId, transcript_status: 'processing', transcript_error: null })
        .eq('id', thread.id);
      console.log(`[poll-transcriptions] herindienen gelukt: job ${jobId} voor thread ${thread.id}`);
      resubmitted++;
    } catch (err) {
      console.error(`[poll-transcriptions] herindienen mislukt voor thread ${thread.id}:`, err?.message ?? err);
    }
  }

  if (resubmitted > 0) {
    console.log(`[poll-transcriptions] ${resubmitted} thread(s) alsnog ingediend`);
  }

  return Response.json({ ok: true, checked: threads.length, processed, failed, resubmitted });
}
