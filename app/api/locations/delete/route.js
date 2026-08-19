import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';

export async function DELETE(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd' }, { status: 401 });

  const tenant = await getTenant();
  if (!tenant?.tenant_config?.features?.locations) {
    return Response.json({ error: 'Geen toegang' }, { status: 403 });
  }

  const { location_id } = await request.json();
  if (!location_id) return Response.json({ error: 'location_id ontbreekt' }, { status: 400 });

  const { data, error } = await supabase
    .from('locations')
    .delete()
    .eq('id', location_id)
    .eq('tenant_id', tenant.id)
    .select('id');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data?.length) return Response.json({ error: 'Locatie niet gevonden of geen toegang' }, { status: 404 });

  return Response.json({ ok: true });
}
