// app/api/suppliers/update/route.js
import { createClient, createServiceClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';

const ALLOWED_FIELDS = ['bijzonderheden', 'favoriet'];

export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd' }, { status: 401 });

  const tenant = await getTenant();
  if (!tenant?.tenant_config?.features?.suppliers) {
    return Response.json({ error: 'Geen toegang' }, { status: 403 });
  }

  const body = await request.json();
  const { supplier_id, ...updates } = body;
  if (!supplier_id) return Response.json({ error: 'supplier_id ontbreekt' }, { status: 400 });

  const safeUpdates = Object.fromEntries(
    Object.entries(updates).filter(([k]) => ALLOWED_FIELDS.includes(k))
  );
  if (Object.keys(safeUpdates).length === 0) {
    return Response.json({ error: 'Geen geldige velden om bij te werken' }, { status: 400 });
  }

  const service = createServiceClient();

  const { data, error } = await service
    .from('suppliers')
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq('id', supplier_id)
    .eq('tenant_id', tenant.id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ supplier: data });
}
