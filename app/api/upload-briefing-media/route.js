// app/api/upload-briefing-media/route.js
import { createClient } from '@/lib/supabase-server';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(request) {
  // Verify authenticated user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const formData = await request.formData();
  const messageId = formData.get('messageId');
  const files = formData.getAll('files');

  if (!messageId || files.length === 0) {
    return Response.json({ error: 'messageId en files zijn verplicht.' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const results = [];

  for (const file of files) {
    const safeName = (file.name || 'foto').replace(/[^a-zA-Z0-9._-]/g, '-');
    const storagePath = `${messageId}/${Date.now()}-${safeName}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error } = await serviceClient.storage
      .from('briefing-media')
      .upload(storagePath, buffer, { upsert: false, contentType: file.type });

    if (error) {
      console.error('upload-briefing-media fout:', error);
      continue;
    }

    results.push({
      url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/briefing-media/${storagePath}`,
      name: file.name,
    });
  }

  return Response.json({ photos: results });
}
