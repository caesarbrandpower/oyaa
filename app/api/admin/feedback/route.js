// app/api/admin/feedback/route.js
import { createClient, createServiceClient } from '@/lib/supabase-server';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== 'admin') return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: 'Verboden.' }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from('feedback')
    .select('id, tenant_id, user_email, page_url, message, status, created_at, tenants(name)')
    .order('created_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ feedback: data ?? [] });
}

export async function PATCH(request) {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: 'Verboden.' }, { status: 403 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  const { id, status } = body;
  if (!id || !['nieuw', 'gelezen', 'afgehandeld'].includes(status)) {
    return Response.json({ error: 'id en geldige status zijn verplicht.' }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from('feedback')
    .update({ status })
    .eq('id', id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
