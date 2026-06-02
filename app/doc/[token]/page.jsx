// app/doc/[token]/page.jsx
import { createServiceClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { notFound } from 'next/navigation';
import SharedDocView from '@/components/custom/SharedDocView';

export default async function SharedDocPage({ params }) {
  const { token } = await params;
  const supabase = createServiceClient();

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
    ? (() => {
        const slug = data.client.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-logos/${slug}.png`;
      })()
    : null;

  return (
    <SharedDocView
      content={data.content}
      title={data.title}
      expiresAt={data.expires_at}
      chaseLogoUrl={chaseLogoUrl}
      clientLogoUrl={clientLogoUrl}
      outputType={data.output_type ?? null}
    />
  );
}
