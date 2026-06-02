// app/api/debug-logo/route.js
// Tijdelijk debug-endpoint — verwijderen na gebruik
// Gebruik: /api/debug-logo?client=Coca-Cola

import { createClient, createServiceClient } from '@/lib/supabase-server';

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Auth vereist' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientName = searchParams.get('client') || 'Coca-Cola';
  const slug = clientName.toLowerCase()
    .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceClient = createServiceClient();

  const { data: files, error: listError } = await serviceClient.storage
    .from('client-logos').list('', { limit: 200 });

  const urlTests = {};
  for (const ext of ['png', 'svg', 'jpg', 'jpeg']) {
    const url = `${supabaseUrl}/storage/v1/object/public/client-logos/${slug}.${ext}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      urlTests[ext] = { url, status: res.status, ok: res.ok };
    } catch (e) {
      urlTests[ext] = { url, error: String(e) };
    }
  }

  const downloadTests = {};
  for (const ext of ['png', 'svg']) {
    const path = `${slug}.${ext}`;
    const { data: blob, error } = await serviceClient.storage.from('client-logos').download(path);
    downloadTests[ext] = { path, ok: !!blob && !error, error: error?.message ?? null };
  }

  return Response.json({
    clientName, slug, supabaseUrl, urlTests, downloadTests,
    bucketFiles: files?.map(f => f.name).sort() ?? [],
    listError: listError?.message ?? null,
  });
}
