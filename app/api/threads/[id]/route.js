// app/api/threads/[id]/route.js
import { createClient } from '@/lib/supabase-server';

export async function DELETE(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { id } = await params;

  const { data: thread } = await supabase
    .from('threads')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!thread) return Response.json({ error: 'Niet gevonden.' }, { status: 404 });

  await supabase.from('messages').delete().eq('thread_id', id);
  await supabase.from('threads').delete().eq('id', id);

  return Response.json({ ok: true });
}

export async function PATCH(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { client, project, title, field_briefing_extras } = body;

  const { data: thread } = await supabase
    .from('threads')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!thread) return Response.json({ error: 'Niet gevonden.' }, { status: 404 });

  const updateData = {};
  if ('client' in body) updateData.client = client ?? null;
  if ('project' in body) updateData.project = project ?? null;
  if (title?.trim()) updateData.title = title.trim();
  if ('field_briefing_extras' in body) updateData.field_briefing_extras = field_briefing_extras ?? null;

  await supabase.from('threads').update(updateData).eq('id', id);

  return Response.json({ ok: true });
}
