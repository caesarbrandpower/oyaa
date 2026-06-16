// app/api/vault/ingest/route.js
// Ontvangt storagePath + fileName na een directe client-side upload naar
// Supabase Storage. Downloadt het bestand server-to-server (geen Vercel
// body-limiet), extraheert tekst, en voert ingestDocument uit.

export const runtime = 'nodejs';
export const maxDuration = 60;

import { createClient, createServiceClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { vaultEnabled } from '@/lib/vault/access';
import { extractFileText } from '@/lib/extract-file-text';
import { ingestDocument } from '@/lib/vault/ingest';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const tenant = await getTenant();
  if (!tenant?.id) return Response.json({ error: 'Geen tenant gevonden.' }, { status: 400 });

  if (!vaultEnabled(tenant)) {
    return Response.json({ error: 'De kluis is niet ingeschakeld voor deze omgeving.' }, { status: 403 });
  }

  const { storagePath, fileName } = await request.json();
  if (!storagePath || !fileName) {
    return Response.json({ error: 'storagePath en fileName zijn verplicht.' }, { status: 400 });
  }

  // Verifieer dat het pad bij deze tenant hoort
  if (!storagePath.startsWith(`${tenant.id}/`)) {
    return Response.json({ error: 'Ongeldig pad.' }, { status: 403 });
  }

  const service = createServiceClient();

  // Server-to-server download: omzeilt de Vercel inbound body-limiet
  const { data: blob, error: downloadError } = await service.storage
    .from('vault')
    .download(storagePath);

  if (downloadError || !blob) {
    console.error('[VAULT] download van storage mislukt:', downloadError?.message);
    return Response.json({ error: 'Bestand downloaden mislukt.' }, { status: 500 });
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  console.log(`[VAULT] ingest gestart: "${fileName}" (${buffer.length} bytes)`);

  let text;
  try {
    text = await extractFileText(buffer, fileName);
  } catch (err) {
    console.error(`[VAULT] tekstextractie mislukt voor "${fileName}":`, err.message);
    return Response.json({ error: err.message }, { status: 400 });
  }

  if (!text?.trim()) {
    console.warn(`[VAULT] geen tekst gevonden in "${fileName}" — mogelijk gescand PDF of leeg bestand`);
    return Response.json({ error: 'Geen tekst gevonden in dit bestand.' }, { status: 400 });
  }

  try {
    const result = await ingestDocument({
      tenantId: tenant.id,
      userId: user.id,
      title: fileName,
      sourceType: 'upload',
      filePath: storagePath,
      rawContent: text,
    });
    return Response.json(result);
  } catch (err) {
    console.error('[VAULT] ingest mislukt:', err?.message ?? err);
    return Response.json({ error: 'Verwerken mislukt.' }, { status: 500 });
  }
}
