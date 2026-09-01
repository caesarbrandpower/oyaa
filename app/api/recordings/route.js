import { createClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  // Haal recordings op met bijbehorende thread_id (als die bestaat).
  // Een recording kan meerdere threads hebben in de toekomst; we tonen de nieuwste.
  const { data: recordings, error } = await supabase
    .from('recordings')
    .select(`
      id, audio_url, storage_path, duration_seconds, client, title,
      transcript_status, transcript_error, created_at,
      threads!threads_recording_id_fkey(id)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Flatten: threads is een array, neem de eerste (meest recente link)
  const result = (recordings ?? []).map(r => ({
    ...r,
    thread_id: r.threads?.[0]?.id ?? null,
    threads: undefined,
  }));

  return Response.json(result);
}
