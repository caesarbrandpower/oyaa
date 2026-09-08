// Geeft een pre-signed upload URL terug zodat de client audio rechtstreeks
// naar Supabase Storage kan sturen zonder Vercel als doorgeefluik.
// Vercel ziet nooit de audio-bytes — alleen twee kleine JSON-requests.

import { createServiceClient } from '@/lib/supabase-server';
import { createClient } from '@/lib/supabase-server';

const ALLOWED_EXTS = new Set(['m4a', 'mp4', 'webm', 'ogg', 'wav', 'aac']);

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

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  const raw = String(body.ext ?? 'm4a').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ext = ALLOWED_EXTS.has(raw) ? raw : 'm4a';
  const path = `${user.id}/${Date.now()}.${ext}`;

  const db = createServiceClient();
  const { data, error } = await db.storage.from('recordings').createSignedUploadUrl(path);

  if (error || !data) {
    console.error('[request-upload] createSignedUploadUrl mislukt:', error);
    return Response.json({ error: 'Kan upload-URL niet aanmaken.' }, { status: 500 });
  }

  return Response.json({ signedUrl: data.signedUrl, path });
}
