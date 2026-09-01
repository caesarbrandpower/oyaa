import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';

export async function POST(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { id } = await params;
  const tenant = await getTenant();

  const { data: rec } = await supabase
    .from('recordings')
    .select('id, audio_url, storage_path, title, client, transcript_status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!rec) return Response.json({ error: 'Niet gevonden.' }, { status: 404 });

  const { data: thread, error } = await supabase
    .from('threads')
    .insert({
      user_id: user.id,
      tenant_id: tenant?.id ?? null,
      title: rec.title || 'Opname',
      output_type: 'recording',
      audio_url: rec.audio_url,
      audio_storage_path: rec.storage_path,
      transcript_status: rec.transcript_status,
      recording_id: rec.id,
    })
    .select('id')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ threadId: thread.id });
}
