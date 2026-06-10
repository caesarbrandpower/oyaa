import { NextResponse } from 'next/server';

export function middleware(request) {
  const host = request.headers.get('host') || '';
  const hostname = host.replace(/:\d+$/, '');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-hostname', hostname);

  // Admin subdomain: redirect root naar /admin
  if (hostname === 'admin.waybetter.nl' && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|sw.js|manifest.json|icon-|doc/).*)'],
};
