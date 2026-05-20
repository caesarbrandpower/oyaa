// app/doc/[token]/page.jsx
import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { notFound } from 'next/navigation';
import SharedDocView from '@/components/custom/SharedDocView';

export default async function SharedDocPage({ params }) {
  const { token } = await params;
  const supabase = await createClient();

  const [{ data }, tenant] = await Promise.all([
    supabase
      .from('shared_documents')
      .select('content, output_type, title, expires_at, client')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single(),
    getTenant(),
  ]);

  if (!data) notFound();

  const chaseLogoUrl = tenant?.logo_url ?? null;
  const clientLogoUrl = data.client
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-logos/${encodeURIComponent(data.client)}.png`
    : null;

  return (
    <SharedDocView
      content={data.content}
      title={data.title}
      expiresAt={data.expires_at}
      chaseLogoUrl={chaseLogoUrl}
      clientLogoUrl={clientLogoUrl}
    />
  );
}
