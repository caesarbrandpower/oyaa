// app/api/suppliers/upload-bijlage/route.js
import { createClient, createServiceClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd' }, { status: 401 });

  const tenant = await getTenant();
  if (!tenant?.tenant_config?.features?.suppliers) {
    return Response.json({ error: 'Geen toegang' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const supplierId = formData.get('supplier_id');

  if (!file || !supplierId) {
    return Response.json({ error: 'Bestand of leverancier-id ontbreekt' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return Response.json({ error: 'Alleen PDF-bestanden zijn toegestaan' }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: sup, error: supError } = await service
    .from('suppliers')
    .select('id, bijlagen')
    .eq('id', supplierId)
    .eq('tenant_id', tenant.id)
    .single();
  if (supError || !sup) {
    return Response.json({ error: 'Leverancier niet gevonden' }, { status: 404 });
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `leveranciers/${tenant.id}/${supplierId}/${timestamp}-${safeName}`;
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

  const bestaand = Array.isArray(sup.bijlagen) ? sup.bijlagen : [];
  const nieuweBijlage = { naam: file.name, url: publicUrl, type: 'pdf' };

  const { error: updateError } = await service
    .from('suppliers')
    .update({ bijlagen: [...bestaand, nieuweBijlage], updated_at: new Date().toISOString() })
    .eq('id', supplierId)
    .eq('tenant_id', tenant.id);
  if (updateError) {
    return Response.json({ error: `Opslaan mislukt: ${updateError.message}` }, { status: 500 });
  }

  return Response.json({ bijlage: nieuweBijlage });
}
