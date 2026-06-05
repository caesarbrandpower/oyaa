// app/api/share-document/route.js
import { createClient } from '@/lib/supabase-server';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  // NOTE: shared_documents table needs:
  //   ALTER TABLE shared_documents ADD COLUMN IF NOT EXISTS client text;
  //   ALTER TABLE shared_documents ADD COLUMN IF NOT EXISTS project text;
  const { content, outputType, title, client, project } = await request.json();
  if (!content?.trim()) {
    return Response.json({ error: 'content is verplicht.' }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('shared_documents')
    .insert({ content, output_type: outputType ?? null, title: title ?? null, client: client ?? null, project: project ?? null, expires_at: expiresAt })
    .select('token')
    .single();

  if (error) {
    console.error('share-document error:', error);
    return Response.json({ error: 'Opslaan mislukt.' }, { status: 500 });
  }

  return Response.json({ token: data.token });
}

export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (!token) return Response.json({ error: 'token is verplicht.' }, { status: 400 });

  const { content } = await request.json();
  if (!content?.trim()) return Response.json({ error: 'content is verplicht.' }, { status: 400 });

  const { error } = await supabase
    .from('shared_documents')
    .update({ content })
    .eq('token', token);

  if (error) {
    console.error('share-document PATCH error:', error);
    return Response.json({ error: 'Bijwerken mislukt.' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
