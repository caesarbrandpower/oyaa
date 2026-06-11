// app/api/messages/route.js
import { createClient } from '@/lib/supabase-server';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { threadId, content } = await request.json();
  if (!threadId || !content?.trim()) {
    return Response.json({ error: 'threadId en content zijn verplicht.' }, { status: 400 });
  }

  // Eigenaarschapscheck
  const { data: thread } = await supabase
    .from('threads')
    .select('id')
    .eq('id', threadId)
    .eq('user_id', user.id)
    .single();

  if (!thread) return Response.json({ error: 'Geen toegang.' }, { status: 403 });

  const { data, error } = await supabase
    .from('messages')
    .insert({ thread_id: threadId, role: 'assistant', content })
    .select('id')
    .single();

  if (error) {
    console.error('[POST /api/messages] insert mislukt:', error);
    return Response.json({ error: 'Opslaan mislukt.' }, { status: 500 });
  }

  return Response.json({ ok: true, id: data.id });
}
