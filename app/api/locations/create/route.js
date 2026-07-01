// app/api/locations/create/route.js
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

  const body = await request.json();
  if (!body.naam?.trim()) {
    return Response.json({ error: 'Naam is verplicht' }, { status: 400 });
  }

  const service = createServiceClient();

  const { data, error } = await service
    .from('locations')
    .insert({
      tenant_id: tenant.id,
      naam: body.naam.trim(),
      omschrijving: body.omschrijving?.trim() || null,
      stad: body.stad?.trim() || null,
      channel: body.channel || null,
      doelgroep: body.doelgroep?.trim() || null,
      telefoon: body.telefoon?.trim() || null,
      email: body.email?.trim() || null,
      website: body.website?.trim() || null,
      parkeren: body.parkeren?.trim() || null,
      laden_lossen: body.laden_lossen?.trim() || null,
      vergunning_status: body.vergunning_status || 'geen',
      vergunning_vervaldatum: body.vergunning_vervaldatum || null,
      bijzonderheden: body.bijzonderheden?.trim() || null,
      bijlagen: Array.isArray(body.bijlagen) ? body.bijlagen : [],
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ location: data }, { status: 201 });
}
