// app/api/proxy-logo/route.js
// Server-side proxy voor externe logo-URLs — bypast CORS voor browser fetch()
// Gebruikt service-client voor Supabase storage (werkt ook bij private buckets)

import { createServiceClient } from '@/lib/supabase-server';

const RESPONSE_HEADERS = {
  'Cache-Control': 'public, max-age=3600',
  'Access-Control-Allow-Origin': '*',
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url || !/^https?:\/\//.test(url)) {
    return new Response('Invalid url', { status: 400 });
  }

  // Voor Supabase storage: gebruik service-client (bypast RLS en bucket-privacy)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const storageMatch = supabaseUrl && url.startsWith(supabaseUrl)
    ? url.match(/\/storage\/v1\/object\/(?:public\/)?([^/?#]+)\/(.+)/)
    : null;

  if (storageMatch) {
    try {
      const [, bucket, path] = storageMatch;
      const supabase = createServiceClient();
      const { data: blob, error } = await supabase.storage.from(bucket).download(path);
      if (!error && blob) {
        const ab = await blob.arrayBuffer();
        return new Response(ab, {
          headers: { 'Content-Type': blob.type || 'image/png', ...RESPONSE_HEADERS },
        });
      }
    } catch { /* fall through to regular fetch */ }
  }

  // Reguliere proxy voor overige URLs
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Waybetter/1.0' },
    });
    if (!res.ok) return new Response('Upstream fetch failed', { status: 502 });
    const buffer = await res.arrayBuffer();
    const ct = res.headers.get('content-type') || 'image/png';
    return new Response(buffer, { headers: { 'Content-Type': ct, ...RESPONSE_HEADERS } });
  } catch {
    return new Response('Error', { status: 500 });
  }
}
