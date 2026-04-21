import { NextResponse } from 'next/server';

export function middleware(request) {
  const host = request.headers.get('host') || '';
  // Strip port voor lokale dev (localhost:3000 -> localhost)
  const hostname = host.replace(/:\d+$/, '');

  const response = NextResponse.next();
  response.headers.set('x-tenant-hostname', hostname);
  return response;
}

export const config = {
  // Alle pagina-requests, maar niet static assets of API-routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|sw.js|manifest.json|icon-).*)'],
};
