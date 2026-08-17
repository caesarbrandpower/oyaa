// app/api/locations/update/route.js
import { createClient, createServiceClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { CHAT_UPDATABLE_FIELDS } from '@/lib/locations-write';

// ALLOWED_FIELDS: alles wat via de interface aanpasbaar is.
// Bevat alle CHAT_UPDATABLE_FIELDS plus vergunning_vervaldatum.
const ALLOWED_FIELDS = [...CHAT_UPDATABLE_FIELDS, 'vergunning_vervaldatum'];

export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd' }, { status: 401 });

  const tenant = await getTenant();
  if (!tenant?.tenant_config?.features?.locations) {
    return Response.json({ error: 'Geen toegang' }, { status: 403 });
  }

  const body = await request.json();
  const { location_id, ...updates } = body;
  if (!location_id) return Response.json({ error: 'location_id ontbreekt' }, { status: 400 });

  const safeUpdates = Object.fromEntries(
    Object.entries(updates).filter(([k]) => ALLOWED_FIELDS.includes(k))
  );
  if (Object.keys(safeUpdates).length === 0) {
    return Response.json({ error: 'Geen geldige velden om bij te werken' }, { status: 400 });
  }

  const service = createServiceClient();

  // Huidige waarden ophalen voor audit-log
  const veldNamen = Object.keys(safeUpdates).join(', ');
  const { data: huidig } = await service
    .from('locations')
    .select(veldNamen)
    .eq('id', location_id)
    .eq('tenant_id', tenant.id)
    .single();

  const { data, error } = await service
    .from('locations')
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq('id', location_id)
    .eq('tenant_id', tenant.id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Audit-log per gewijzigd veld
  if (huidig) {
    const wijzigingen = Object.entries(safeUpdates).map(([veld, nieuw]) => ({
      location_id,
      tenant_id: tenant.id,
      user_id: user.id,
      gewijzigd_via: 'interface',
      veld_naam: veld,
      oude_waarde: huidig[veld] != null ? String(huidig[veld]) : null,
      nieuwe_waarde: nieuw != null ? String(nieuw) : null,
    }));
    await service.from('location_changes').insert(wijzigingen).then(
      ({ error: e }) => { if (e) console.error('[LOCATION-UPDATE] audit-log mislukt:', e.message); },
      (err) => console.error('[LOCATION-UPDATE] audit-log exception:', err)
    );
  }

  return Response.json({ location: data });
}
