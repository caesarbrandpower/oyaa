// app/api/threads/[id]/route.js
import { createClient, createServiceClient } from '@/lib/supabase-server';

const EU_SPEECHMATICS = 'https://eu1.asr.api.speechmatics.com';

async function cancelSpeechmaticsJob(jobId) {
  if (!jobId) return { ok: true };
  const apiKey = process.env.SPEECHMATICS_API_KEY;
  if (!apiKey) return { ok: false, error: 'SPEECHMATICS_API_KEY ontbreekt' };
  try {
    const res = await fetch(`${EU_SPEECHMATICS}/v2/jobs/${jobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok || res.status === 404) return { ok: true };
    const body = await res.text();
    return { ok: false, error: `Speechmatics DELETE ${res.status}: ${body}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function resolveUser(request) {
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (bearerToken) {
    const { data: { user }, error } = await createServiceClient().auth.getUser(bearerToken);
    return (error || !user) ? null : user;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function DELETE(request, { params }) {
  const user = await resolveUser(request);
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { id } = await params;
  const db = createServiceClient();

  const { data: thread } = await db
    .from('threads')
    .select('id, user_id, audio_storage_path, speechmatics_job_id, transcript_status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!thread) return Response.json({ error: 'Niet gevonden.' }, { status: 404 });

  const warnings = [];

  if (thread.speechmatics_job_id && ['queued', 'processing'].includes(thread.transcript_status)) {
    const result = await cancelSpeechmaticsJob(thread.speechmatics_job_id);
    if (!result.ok) {
      console.error('[DELETE /api/threads/:id] Speechmatics annuleren mislukt:', result.error);
      warnings.push(`Speechmatics-job kon niet worden geannuleerd: ${result.error}`);
    }
  }

  if (thread.audio_storage_path) {
    const { error: storageErr } = await db.storage
      .from('recordings')
      .remove([thread.audio_storage_path]);
    if (storageErr) {
      console.error('[DELETE /api/threads/:id] Storage remove mislukt:', storageErr.message);
      warnings.push(`Audio niet verwijderd uit opslag: ${storageErr.message}`);
    }
  }

  await db.from('messages').delete().eq('thread_id', id);
  const { error: threadErr } = await db.from('threads').delete().eq('id', id);

  if (threadErr) {
    return Response.json({ error: 'Thread verwijderen mislukt.', warnings }, { status: 500 });
  }

  return Response.json({ ok: true, warnings });
}

export async function PATCH(request, { params }) {
  const user = await resolveUser(request);
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { client, project, title, field_briefing_extras } = body;

  const db = createServiceClient();

  const { data: thread } = await db
    .from('threads')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!thread) return Response.json({ error: 'Niet gevonden.' }, { status: 404 });

  const updateData = {};
  if ('client' in body) updateData.client = client ?? null;
  if ('project' in body) updateData.project = project ?? null;
  if (title?.trim()) updateData.title = title.trim();
  if ('field_briefing_extras' in body) updateData.field_briefing_extras = field_briefing_extras ?? null;

  await db.from('threads').update(updateData).eq('id', id);

  return Response.json({ ok: true });
}
