// app/(custom)/app/opnames/page.jsx
import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { redirect } from 'next/navigation';
import RecordingsPage from '@/components/custom/RecordingsPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Opnames — Waybetter',
};

export default async function OpnamesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await getTenant(); // zorgt dat tenant-context geladen is

  const { data: recordings } = await supabase
    .from('recordings')
    .select('id, audio_url, storage_path, duration_seconds, client, title, transcript_status, transcript_error, created_at, threads!threads_recording_id_fkey(id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const flat = (recordings ?? []).map(r => ({
    ...r,
    thread_id: r.threads?.[0]?.id ?? null,
    threads: undefined,
  }));

  return <RecordingsPage initialRecordings={flat} />;
}
