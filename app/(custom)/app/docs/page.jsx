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
  const { data: threads } = await supabase
    .from('threads')
    .select('id, title, output_type, created_at, updated_at, client, project')
    .eq('user_id', user.id)
    .in('output_type', ['meeting-summary', 'project-briefing', 'account-pm-briefing', 'evaluation'])
    .order('updated_at', { ascending: false });

  // Alle threads voor de sidebar
  const { data: allThreads } = await supabase
    .from('threads')
    .select('id, title, output_type, created_at, updated_at, client')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(20);

  const { data: projectRows } = await supabase
    .from('threads')
    .select('client')
    .eq('user_id', user.id)
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
