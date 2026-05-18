// app/api/threads/[id]/route.js
import { createClient } from '@/lib/supabase-server';

export async function PATCH(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { id } = await params;
  const { client, project } = await request.json();

  const { data: thread } = await supabase
    .from('threads')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!thread) return Response.json({ error: 'Niet gevonden.' }, { status: 404 });

  await supabase
    .from('threads')
    .update({ client: client ?? null, project: project ?? null })
    .eq('id', id);

  return Response.json({ ok: true });
}
