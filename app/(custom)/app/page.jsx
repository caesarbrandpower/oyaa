// app/(custom)/app/page.jsx
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
    .select('id, title, output_type, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(20);

  // Voornaam uit metadata of email prefix
  const firstName =
    user.user_metadata?.full_name?.split(' ')[0] ||
    user.user_metadata?.name?.split(' ')[0] ||
    user.email.split('@')[0];

  const prefill = (await searchParams)?.prefill ?? null;

  return (
    <ChatPage
      user={{ id: user.id, email: user.email, firstName }}
      tenant={tenant}
      initialThreads={threads ?? []}
      initialPrefill={prefill}
    />
  );
}
