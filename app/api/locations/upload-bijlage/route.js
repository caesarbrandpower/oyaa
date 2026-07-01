// app/api/locations/upload-bijlage/route.js
import { createClient, createServiceClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd' }, { status: 401 });

  const tenant = await getTenant();
  if (!tenant?.tenant_config?.features?.locations) {
    return Response.json({ error: 'Geen toegang' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const locationId = formData.get('location_id');

  if (!file || !locationId) {
    return Response.json({ error: 'Bestand of locatie-id ontbreekt' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return Response.json({ error: 'Alleen PDF-bestanden zijn toegestaan' }, { status: 400 });
  }

  const service = createServiceClient();

  // Controleer dat de locatie bij deze tenant hoort
  const { data: loc, error: locError } = await service
    .from('locations')
    .select('id, bijlagen')
    .eq('id', locationId)
    .eq('tenant_id', tenant.id)
    .single();
  if (locError || !loc) {
    return Response.json({ error: 'Locatie niet gevonden' }, { status: 404 });
  }

  // Upload naar Storage: gestructureerd pad per tenant + locatie
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${tenant.id}/${locationId}/${timestamp}-${safeName}`;
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

  // Voeg toe aan bijlagen array (bestaande blijven staan)
  const bestaand = Array.isArray(loc.bijlagen) ? loc.bijlagen : [];
  const nieuweBijlage = { naam: file.name, url: publicUrl, type: 'pdf' };

  const { error: updateError } = await service
    .from('locations')
    .update({ bijlagen: [...bestaand, nieuweBijlage], updated_at: new Date().toISOString() })
    .eq('id', locationId)
    .eq('tenant_id', tenant.id);
  if (updateError) {
    return Response.json({ error: `Opslaan mislukt: ${updateError.message}` }, { status: 500 });
  }

  return Response.json({ bijlage: nieuweBijlage });
}
