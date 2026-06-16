// app/api/vault/request-upload/route.js
// Genereert een presigned upload URL voor Supabase Storage zodat de client
// het bestand direct uploadt (omzeilt de Vercel 4.5MB body-limiet).

export const runtime = 'nodejs';

import { createClient, createServiceClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { vaultEnabled } from '@/lib/vault/access';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const tenant = await getTenant();
  if (!tenant?.id) return Response.json({ error: 'Geen tenant gevonden.' }, { status: 400 });

  if (!vaultEnabled(tenant)) {
    return Response.json({ error: 'De kluis is niet ingeschakeld voor deze omgeving.' }, { status: 403 });
  }

  const { fileName } = await request.json();
  if (!fileName?.trim()) return Response.json({ error: 'Geen bestandsnaam.' }, { status: 400 });

  const safeName = fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  const storagePath = `${tenant.id}/uploads/${Date.now()}-${safeName}`;

  const service = createServiceClient();
  const { data, error } = await service.storage
    .from('vault')
    .createSignedUploadUrl(storagePath);

  if (error) {
    console.error('[VAULT] signed upload URL mislukt:', error.message);
    return Response.json({ error: 'Upload URL aanmaken mislukt.' }, { status: 500 });
  }

  return Response.json({ signedUrl: data.signedUrl, storagePath });
}
