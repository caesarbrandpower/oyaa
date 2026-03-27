import { NextResponse } from 'next/server';

export function middleware(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabaseConfigured =
    supabaseUrl &&
    supabaseUrl !== 'your_supabase_url' &&
    supabaseUrl.startsWith('http') &&
    supabaseKey &&
    supabaseKey !== 'your_supabase_anon_key';

  // No Supabase — block /projects and /login, let everything else through
  if (!supabaseConfigured) {
    if (request.nextUrl.pathname.startsWith('/projects') || request.nextUrl.pathname === '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Supabase is configured — check auth via cookie presence
  // Full auth validation happens at the page/API level via supabase-server
  const hasAuthCookie = request.cookies.getAll().some(c => c.name.startsWith('sb-'));

  const isAuthPage = request.nextUrl.pathname === '/login';
  const isPublicPage = request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/privacy';
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  if (isPublicPage || isApiRoute) {
    return NextResponse.next();
  }

  if (!hasAuthCookie && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (hasAuthCookie && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/projects';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
