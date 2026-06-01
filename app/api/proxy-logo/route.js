// app/api/proxy-logo/route.js
// Server-side proxy voor externe logo-URLs — bypast CORS voor browser fetch()

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url || !/^https?:\/\//.test(url)) {
    return new Response('Invalid url', { status: 400 });
  }
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Waybetter/1.0' },
    });
    if (!res.ok) return new Response('Upstream fetch failed', { status: 502 });
    const buffer = await res.arrayBuffer();
    const ct = res.headers.get('content-type') || 'image/png';
    return new Response(buffer, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('Error', { status: 500 });
  }
}
