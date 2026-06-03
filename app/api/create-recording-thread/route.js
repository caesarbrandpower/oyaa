// app/api/create-recording-thread/route.js
// Accepteert een audio-blob, transcribeert via Whisper, maakt een thread aan
// en slaat het transcript op als gebruikersbericht.
export const maxDuration = 120;

import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';

function pad(n) {
  return String(n).padStart(2, '0');
}

function recordingTitle() {
  const now = new Date();
  return `Opname ${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
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

  const client = formData.get('client') || null;
  const project = formData.get('project') || null;

  // Transcribeer direct via Whisper API
  const whisperFormData = new FormData();
  whisperFormData.append('file', audioFile);

  const transcribeRes = await fetch(new URL('/api/transcribe', request.url).toString(), {
    method: 'POST',
    body: whisperFormData,
    headers: { cookie: request.headers.get('cookie') || '' },
  });

  if (!transcribeRes.ok) {
    return Response.json({ error: 'Transcriptie mislukt.' }, { status: 500 });
  }

  const { transcript, error: transcribeError } = await transcribeRes.json();
  if (transcribeError || !transcript) {
    return Response.json({ error: transcribeError || 'Leeg transcript.' }, { status: 500 });
  }

  // Maak thread aan
  const title = recordingTitle();
  const { data: thread, error: threadError } = await supabase
    .from('threads')
    .insert({
      user_id: user.id,
      tenant_id: tenant?.id ?? null,
      title,
      output_type: null,
      client: client || null,
      project: project || null,
    })
    .select('id')
    .single();

  if (threadError) {
    return Response.json({ error: 'Thread aanmaken mislukt.' }, { status: 500 });
  }

  // Sla transcript op als gebruikersbericht
  await supabase.from('messages').insert({
    thread_id: thread.id,
    role: 'user',
    content: transcript,
    attachments: [],
  });

  // Upload audio naar Supabase Storage
  let audioUrl = null;
  try {
    const ext = audioFile.name?.split('.').pop() || 'webm';
    const storagePath = `${user.id}/${thread.id}/${Date.now()}.${ext}`;
    const audioBuffer = await audioFile.arrayBuffer();

    const { data: storageData, error: storageError } = await supabase.storage
      .from('recordings')
      .upload(storagePath, audioBuffer, {
        contentType: audioFile.type || 'audio/webm',
        upsert: false,
      });

    if (!storageError && storageData) {
      const { data: { publicUrl } } = supabase.storage
        .from('recordings')
        .getPublicUrl(storagePath);
      audioUrl = publicUrl;
      await supabase.from('threads').update({ audio_url: audioUrl }).eq('id', thread.id);
    }
  } catch {
    // Audio upload mislukt — thread en transcript zijn al opgeslagen, doorgaan
  }

  return Response.json({ threadId: thread.id, title, transcript, audioUrl });
}
