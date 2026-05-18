// app/(custom)/app/page.jsx
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { redirect } from 'next/navigation';
import ChatPage from '@/components/custom/ChatPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Waybetter',
};

export default async function AppPage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const tenant = await getTenant();

  const { data: threads } = await supabase
    .from('threads')
    .select('id, title, output_type, created_at, updated_at, client, audio_url')
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

  // Voornaam uit metadata of email prefix
  const firstName =
    user.user_metadata?.full_name?.split(' ')[0] ||
    user.user_metadata?.name?.split(' ')[0] ||
    user.email.split('@')[0];

  const prefill = (await searchParams)?.prefill ?? null;

  return (
    <Suspense>
      <ChatPage
        user={{ id: user.id, email: user.email, firstName }}
        tenant={tenant}
        initialThreads={threads ?? []}
        initialPrefill={prefill}
        projects={projects}
      />
    </Suspense>
  );
}
