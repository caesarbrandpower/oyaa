import { createClient, createServiceClient } from '@/lib/supabase-server';

export async function PATCH(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const update = {};
  if ('title'  in body) update.title  = body.title?.trim()  || null;
  if ('client' in body) update.client = body.client?.trim() || null;

  const { error } = await supabase
    .from('recordings')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { id } = await params;

  // Haal storage_path op vóór verwijdering
  const { data: rec } = await supabase
    .from('recordings')
    .select('storage_path, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!rec) return Response.json({ error: 'Niet gevonden.' }, { status: 404 });

  // Verwijder uit Storage als er een pad is (service client bypasses Storage RLS)
  if (rec.storage_path) {
    const svc = createServiceClient();
    await svc.storage.from('recordings').remove([rec.storage_path]);
  }

  // Verwijder recording-rij (thread.recording_id wordt NULL via ON DELETE SET NULL)
  const { error } = await supabase
    .from('recordings')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
