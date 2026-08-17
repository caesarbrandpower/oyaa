// app/api/locations/chat-write/route.js
import { createClient, createServiceClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { CHAT_UPDATABLE_FIELDS } from '@/lib/locations-write';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd' }, { status: 401 });

  const tenant = await getTenant();
  if (!tenant?.tenant_config?.features?.locations) {
    return Response.json({ error: 'Geen toegang' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Ongeldig verzoek' }, { status: 400 });
  }

  const { locationId, veld, nieuweWaarde, modus = 'vervangen' } = body;
  if (!locationId || !veld || nieuweWaarde === undefined) {
    return Response.json({ error: 'locationId, veld en nieuweWaarde zijn verplicht' }, { status: 400 });
  }
  if (!CHAT_UPDATABLE_FIELDS.includes(veld)) {
    return Response.json({ error: `Veld '${veld}' mag niet via de chat worden aangepast` }, { status: 400 });
  }

  const service = createServiceClient();

  // Controleer eigenaarschap via tenant
  const { data: loc, error: locError } = await service
    .from('locations')
    .select('id, naam, tenant_id, ' + veld)
    .eq('id', locationId)
    .single();

  if (locError || !loc) {
    return Response.json({ error: 'Locatie niet gevonden' }, { status: 404 });
  }
  if (loc.tenant_id !== tenant.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const oudeWaarde = loc[veld] ?? null;

  const APPEND_FIELDS = ['bijzonderheden', 'bereik_note', 'omschrijving'];
  let definitieveWaarde;
  if (modus === 'aanvullen' && APPEND_FIELDS.includes(veld) && oudeWaarde) {
    definitieveWaarde = `${oudeWaarde}\n${nieuweWaarde}`;
  } else {
    definitieveWaarde = nieuweWaarde ?? null;
  }

  // Schrijf de wijziging
  const { data: updated, error: updateError } = await service
    .from('locations')
    .update({ [veld]: definitieveWaarde, updated_at: new Date().toISOString() })
    .eq('id', locationId)
    .eq('tenant_id', tenant.id)
    .select()
    .single();

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  // Audit-log
  const { data: change, error: changeError } = await service
    .from('location_changes')
    .insert({
      location_id: locationId,
      tenant_id: tenant.id,
      user_id: user.id,
      gewijzigd_via: 'chat',
      veld_naam: veld,
      oude_waarde: oudeWaarde != null ? String(oudeWaarde) : null,
      nieuwe_waarde: definitieveWaarde,
    })
    .select()
    .single();

  if (changeError) {
    console.error('[LOCATION-WRITE] audit-log mislukt (niet-fataal):', changeError.message);
  }

  return Response.json({ location: updated, change: change ?? null }, { status: 200 });
}
