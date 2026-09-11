// app/api/clients/route.js
import { createClient, createServiceClient } from '@/lib/supabase-server';

export async function GET(request) {
  let user;
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearerToken) {
    const { data: { user: tokenUser }, error } = await createServiceClient().auth.getUser(bearerToken);
    if (error || !tokenUser) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });
    user = tokenUser;
  } else {
    const supabase = await createClient();
    const { data: { user: cookieUser } } = await supabase.auth.getUser();
    if (!cookieUser) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });
    user = cookieUser;
  }

  const db = createServiceClient();
  const { data } = await db
    .from('threads')
    .select('client')
    .eq('user_id', user.id)
    .not('client', 'is', null)
    .order('client');

  const clients = [...new Set((data || []).map(r => r.client).filter(Boolean))];
  return Response.json({ clients });
}
