// app/api/create-recording-thread/route.js
// Accepteert een audio-blob, transcribeert via Whisper, maakt een thread aan
// en slaat het transcript op als gebruikersbericht.
export const maxDuration = 120;

import { createClient, createServiceClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';

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
  // Web app: cookie-based session. Desktop app: Authorization: Bearer header.
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

  // Service client bypasses RLS — safe because user_id is set explicitly from validated token.
  const db = createServiceClient();
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
  const title = recordingTitle(client);
  const { data: thread, error: threadError } = await db
    .from('threads')
    .insert({
      user_id: user.id,
      tenant_id: tenant?.id ?? null,
      title,
      output_type: 'recording',
      client: client || null,
      project: project || null,
    })
    .select('id')
    .single();

  if (threadError) {
    return Response.json({ error: 'Thread aanmaken mislukt.' }, { status: 500 });
  }

  // Sla transcript op als gebruikersbericht
  await db.from('messages').insert({
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

    const { data: storageData, error: storageError } = await db.storage
      .from('recordings')
      .upload(storagePath, audioBuffer, {
        contentType: audioFile.type || 'audio/webm',
        upsert: false,
      });

    if (!storageError && storageData) {
      const { data: { publicUrl } } = db.storage
        .from('recordings')
        .getPublicUrl(storagePath);
      audioUrl = publicUrl;
      await db.from('threads').update({ audio_url: audioUrl }).eq('id', thread.id);
    }
  } catch {
    // Audio upload mislukt — thread en transcript zijn al opgeslagen, doorgaan
  }

  return Response.json({ threadId: thread.id, title, transcript, audioUrl });
}
