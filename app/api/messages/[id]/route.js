// app/api/messages/[id]/route.js
import { createClient } from '@/lib/supabase-server';

export async function PATCH(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { id } = await params;
  const { content } = await request.json();
  if (!content?.trim()) return Response.json({ error: 'content is verplicht.' }, { status: 400 });

  // Eigenaarschapscheck: bericht moet in een thread van deze gebruiker zitten.
  // De UPDATE-policy op messages (019_messages_update_policy.sql) dekt dit via RLS,
  // maar een expliciete check geeft een 404 in plaats van een stille 0-rijen-update.
  const { data: msg } = await supabase
    .from('messages')
    .select('id, thread_id')
    .eq('id', id)
    .single();

  if (!msg) return Response.json({ error: 'Bericht niet gevonden.' }, { status: 404 });

  const { data: thread } = await supabase
    .from('threads')
    .select('id')
    .eq('id', msg.thread_id)
    .eq('user_id', user.id)
    .single();

  if (!thread) return Response.json({ error: 'Geen toegang.' }, { status: 403 });

  const { error } = await supabase
    .from('messages')
    .update({ content })
    .eq('id', id);

  if (error) {
    console.error('[PATCH /api/messages/:id] update mislukt:', error);
    return Response.json({ error: 'Opslaan mislukt.' }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { id } = await params;

  const { data: msg } = await supabase
    .from('messages')
    .select('id, thread_id')
    .eq('id', id)
    .single();

  if (!msg) return Response.json({ error: 'Bericht niet gevonden.' }, { status: 404 });

  const { data: thread } = await supabase
    .from('threads')
    .select('id')
    .eq('id', msg.thread_id)
    .eq('user_id', user.id)
    .single();

  if (!thread) return Response.json({ error: 'Geen toegang.' }, { status: 403 });

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[DELETE /api/messages/:id] delete mislukt:', error);
    return Response.json({ error: 'Verwijderen mislukt.' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
