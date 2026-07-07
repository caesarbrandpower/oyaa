// app/(custom)/app/docs/page.jsx
import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { redirect } from 'next/navigation';
import DocsPage from '@/components/custom/DocsPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Documenten — Waybetter',
};

export default async function DocsArchivePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tenant = await getTenant();

  // Alle document-type threads (gesorteerd nieuwste eerst)
  const { data: docThreads } = await supabase
    .from('threads')
    .select('id, title, output_type, created_at, updated_at, client, project, audio_url')
    .eq('user_id', user.id)
    .eq('tenant_id', tenant.id)
    .in('output_type', ['meeting-summary', 'project-briefing', 'account-pm-briefing', 'evaluation', 'account-to-pm', 'field-briefing', 'external-debrief', 'account-to-creation'])
    .order('updated_at', { ascending: false });

  // Opname-threads (audio_url aanwezig, nog geen gegenereerd document)
  const { data: recordingThreads } = await supabase
    .from('threads')
    .select('id, title, output_type, created_at, updated_at, client, project, audio_url')
    .eq('user_id', user.id)
    .eq('tenant_id', tenant.id)
    .not('audio_url', 'is', null)
    .order('updated_at', { ascending: false });

  // Merge: documenten + opnames (zonder duplicaten), nieuwste eerst
  const docIds = new Set((docThreads ?? []).map((t) => t.id));
  const threads = [
    ...(docThreads ?? []),
    ...(recordingThreads ?? []).filter((t) => !docIds.has(t.id)),
  ].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

  // Alle threads voor de sidebar
  const { data: allThreads } = await supabase
    .from('threads')
    .select('id, title, output_type, created_at, updated_at, client, audio_url')
    .eq('user_id', user.id)
    .eq('tenant_id', tenant.id)
    .order('updated_at', { ascending: false })
    .limit(20);

  const { data: projectRows } = await supabase
    .from('threads')
    .select('client')
    .eq('user_id', user.id)
    .eq('tenant_id', tenant.id)
    .not('output_type', 'is', null)
    .not('client', 'is', null);

  const projectMap = {};
  for (const t of projectRows ?? []) {
    projectMap[t.client] = (projectMap[t.client] || 0) + 1;
  }
  const projects = Object.entries(projectMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  const firstName =
    user.user_metadata?.full_name?.split(' ')[0] ||
    user.user_metadata?.name?.split(' ')[0] ||
    user.email.split('@')[0];

  return (
    <DocsPage
      user={{ id: user.id, email: user.email, firstName }}
      tenant={tenant}
      docThreads={threads ?? []}
      sidebarThreads={allThreads ?? []}
      projects={projects}
    />
  );
}
