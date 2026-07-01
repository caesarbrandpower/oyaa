// app/api/locations/favoriet/route.js
// Togglet een locatie als favoriet voor de ingelogde gebruiker.
import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';

export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd' }, { status: 401 });

  const tenant = await getTenant();
  if (!tenant?.tenant_config?.features?.locations) {
    return Response.json({ error: 'Geen toegang' }, { status: 403 });
  }

  const { location_id } = await request.json();
  if (!location_id) return Response.json({ error: 'location_id ontbreekt' }, { status: 400 });

  // Controleer dat de locatie bij deze tenant hoort
  const { data: loc } = await supabase
    .from('locations')
    .select('id')
    .eq('id', location_id)
    .eq('tenant_id', tenant.id)
    .single();
  if (!loc) return Response.json({ error: 'Locatie niet gevonden' }, { status: 404 });

  // Kijk of het al een favoriet is
  const { data: existing } = await supabase
    .from('location_favorites')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('location_id', location_id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('location_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('location_id', location_id);
    return Response.json({ favoriet: false });
  } else {
    await supabase
      .from('location_favorites')
      .insert({ user_id: user.id, location_id });
    return Response.json({ favoriet: true });
  }
}
