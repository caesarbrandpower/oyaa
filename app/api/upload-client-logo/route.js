// app/api/upload-client-logo/route.js
import { createClient } from '@/lib/supabase-server';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(request) {
  // Verify authenticated user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file');
  const clientName = formData.get('clientName');

  if (!file || !clientName) {
    return Response.json({ error: 'file en clientName zijn verplicht.' }, { status: 400 });
  }

  const ext = (file.name || 'logo').split('.').pop().toLowerCase() || 'png';
  const slug = clientName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const storagePath = `${slug}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.storage
    .from('client-logos')
    .upload(storagePath, buffer, { upsert: true, contentType: file.type });

  if (error) {
    console.error('upload-client-logo fout:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-logos/${storagePath}`;
  return Response.json({ url: publicUrl });
}
