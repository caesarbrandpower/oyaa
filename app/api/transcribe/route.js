import { createServiceClient } from '@/lib/supabase-server';
import { transcribeAudio } from '@/lib/whisper';

export const maxDuration = 300;

const ALLOWED_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
  'audio/x-m4a', 'audio/wav', 'audio/wave', 'audio/ogg',
  'audio/webm', 'video/mp4', 'video/webm',
];
const ALLOWED_EXTS = ['.mp3', '.m4a', '.mp4', '.wav', '.ogg', '.webm'];
const MAX_DIRECT_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return handleStoragePath(request);
  }
  return handleDirectUpload(request);
}

// ── Storage path (chunked file uploads) ────────────────────────────────────

async function handleStoragePath(request) {
  let storagePath, tenantId;
  try {
    const body = await request.json();
    storagePath = body.storagePath;
    tenantId = body.tenantId ?? null;
  } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  if (!storagePath || typeof storagePath !== 'string') {
    return Response.json({ error: 'Geen storagePath ontvangen.' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Download chunk from Supabase Storage
  let fileBlob;
  try {
    const { data, error } = await supabase.storage
      .from('audio-temp')
      .download(storagePath);
    if (error) throw error;
    fileBlob = data;
  } catch (err) {
    console.error('Storage download error:', err);
    return Response.json(
      { error: 'Kon het audiobestand niet ophalen. Probeer opnieuw.' },
      { status: 502 }
    );
  }

  // Send to Whisper (Azure EU)
  let transcript;
  try {
    const file = new File([fileBlob], 'chunk.wav', { type: 'audio/wav' });
    transcript = await transcribeAudio(file, { tenantId });
    console.log('[whisper/storage] filtered length:', transcript?.length ?? 'null', '| preview:', transcript?.slice(0, 120));
  } catch (err) {
    console.error('Whisper error:', err);
    await supabase.storage.from('audio-temp').remove([storagePath]).catch(() => {});
    return Response.json(
      { error: 'Er is een fout bij de transcriptiedienst. Probeer het opnieuw.' },
      { status: 502 }
    );
  }

  // Clean up temp file
  await supabase.storage.from('audio-temp').remove([storagePath]).catch((err) => {
    console.error('Storage cleanup error (non-fatal):', err);
  });

  return Response.json({ transcript });
}

// ── Direct upload (fast path for live recordings) ──────────────────────────

async function handleDirectUpload(request) {
  let file, tenantId;
  try {
    const formData = await request.formData();
    file = formData.get('file');
    tenantId = formData.get('tenantId') ?? null;
  } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  if (!file) {
    return Response.json({ error: 'Geen audiobestand ontvangen.' }, { status: 400 });
  }

  if (file.size > MAX_DIRECT_SIZE) {
    return Response.json(
      { error: 'Bestand is te groot. Maximum is 25MB voor directe upload.' },
      { status: 400 }
    );
  }

  const name = file.name?.toLowerCase() || '';
  const ext = name.slice(name.lastIndexOf('.'));
  const typeOk = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTS.includes(ext);
  if (!typeOk) {
    return Response.json(
      { error: `Bestandstype "${ext || file.type}" wordt niet ondersteund.` },
      { status: 400 }
    );
  }

  try {
    const transcript = await transcribeAudio(file, { tenantId });
    console.log('[whisper/direct] filtered length:', transcript?.length ?? 'null', '| preview:', transcript?.slice(0, 120));
    return Response.json({ transcript });
  } catch (err) {
    console.error('Whisper error (direct upload):', err);
    return Response.json(
      { error: 'Er is een fout bij de transcriptiedienst. Probeer het opnieuw.' },
      { status: 502 }
    );
  }
}
