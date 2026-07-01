// app/api/suppliers/create/route.js
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

  const body = await request.json();
  if (!body.naam?.trim()) {
    return Response.json({ error: 'Naam is verplicht' }, { status: 400 });
  }

  const service = createServiceClient();

  const { data, error } = await service
    .from('suppliers')
    .insert({
      tenant_id: tenant.id,
      naam: body.naam.trim(),
      omschrijving: body.omschrijving?.trim() || null,
      categorie: body.categorie || null,
      contactpersoon: body.contactpersoon?.trim() || null,
      telefoon: body.telefoon?.trim() || null,
      email: body.email?.trim() || null,
      website: body.website?.trim() || null,
      regio: body.regio?.trim() || null,
      levertijd: body.levertijd?.trim() || null,
      prijsindicatie: body.prijsindicatie?.trim() || null,
      beoordeling: body.beoordeling || null,
      bijzonderheden: body.bijzonderheden?.trim() || null,
      bijlagen: [],
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ supplier: data }, { status: 201 });
}
