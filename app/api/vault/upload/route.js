// app/api/vault/upload/route.js
// Upload-endpoint voor de kluis: auth, tenant via getTenant (werkt in API-routes
// dankzij de host-fallback), binarie naar de vault-bucket, tekst de kluis in.

export const runtime = 'nodejs';
export const maxDuration = 60;

import { createClient, createServiceClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { extractFileText } from '@/lib/extract-file-text';
import { ingestDocument } from '@/lib/vault/ingest';
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

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return Response.json({ error: 'Geen bestand.' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  console.log(`[VAULT] upload gestart: "${file.name}" (${file.type || 'onbekend type'}, ${buffer.length} bytes)`);

  let text;
  try {
    text = await extractFileText(buffer, file.name);
  } catch (err) {
    console.error(`[VAULT] tekstextractie mislukt voor "${file.name}":`, err.message);
    return Response.json({ error: err.message }, { status: 400 });
  }
  if (!text?.trim()) {
    console.warn(`[VAULT] geen tekst gevonden in "${file.name}" — mogelijk gescand PDF of leeg bestand`);
    return Response.json({ error: 'Geen tekst gevonden in dit bestand.' }, { status: 400 });
  }

  // Binarie bewaren; mislukt dit, dan gaat de ingest gewoon door (file_path null)
  const service = createServiceClient();
  const storagePath = `${tenant.id}/uploads/${Date.now()}-${file.name}`;
  const { error: storageError } = await service.storage
    .from('vault')
    .upload(storagePath, buffer, { contentType: file.type || 'application/octet-stream' });
  if (storageError) console.error('[VAULT] storage upload mislukt:', storageError.message);

  try {
    const result = await ingestDocument({
      tenantId: tenant.id,
      userId: user.id,
      title: file.name,
      sourceType: 'upload',
      filePath: storageError ? null : storagePath,
      rawContent: text,
    });
    return Response.json(result);
  } catch (err) {
    console.error('[VAULT] ingest mislukt:', err?.message ?? err);
    return Response.json({ error: 'Verwerken mislukt.' }, { status: 500 });
  }
}
