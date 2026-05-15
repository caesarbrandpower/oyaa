// app/doc/[token]/page.jsx
import { createClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import SharedDocView from '@/components/custom/SharedDocView';

export default async function SharedDocPage({ params }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('shared_documents')
    .select('content, output_type, title, expires_at')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!data) notFound();

  return (
    <SharedDocView
      content={data.content}
      title={data.title}
      expiresAt={data.expires_at}
    />
  );
}
