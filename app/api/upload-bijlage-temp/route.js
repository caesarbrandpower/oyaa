// app/api/upload-bijlage-temp/route.js
// Tijdelijke bijlage-upload voor gebruik in aanmaakformulieren,
// voordat een record-ID beschikbaar is.
import { createClient, createServiceClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd' }, { status: 401 });

  const tenant = await getTenant();
  if (!tenant) return Response.json({ error: 'Geen toegang' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) return Response.json({ error: 'Geen bestand' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return Response.json({ error: 'Alleen PDF-bestanden zijn toegestaan' }, { status: 400 });
  }

  const service = createServiceClient();
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `temp/${tenant.id}/${timestamp}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await service.storage
    .from('locatie-bijlagen')
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false });

  if (uploadError) {
    return Response.json({ error: `Upload mislukt: ${uploadError.message}` }, { status: 500 });
  }

  const { data: { publicUrl } } = service.storage
    .from('locatie-bijlagen')
    .getPublicUrl(storagePath);

  return Response.json({ bijlage: { naam: file.name, url: publicUrl, type: 'pdf' } });
}
