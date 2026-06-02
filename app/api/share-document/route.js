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

  const { data, error } = await supabase
    .from('shared_documents')
    .insert({ content, output_type: outputType ?? null, title: title ?? null, client: client ?? null, project: project ?? null })
    .select('token')
    .single();

  if (error) {
    console.error('share-document error:', error);
    return Response.json({ error: 'Opslaan mislukt.' }, { status: 500 });
  }

  return Response.json({ token: data.token });
}
