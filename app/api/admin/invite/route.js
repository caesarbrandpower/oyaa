// app/api/admin/invite/route.js
import { createClient, createServiceClient } from '@/lib/supabase-server';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== 'admin') return null;
  return user;
}

export async function POST(request) {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: 'Verboden.' }, { status: 403 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  const { email, hostname } = body;
  if (!email || !hostname) {
    return Response.json({ error: 'email en hostname zijn verplicht.' }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: `https://${hostname}/auth/confirm`,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
