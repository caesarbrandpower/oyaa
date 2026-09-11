// app/api/clients/route.js
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const { data } = await supabase
    .from('threads')
    .select('client')
    .not('client', 'is', null)
    .order('client');

  const clients = [...new Set((data || []).map(r => r.client).filter(Boolean))];
  return Response.json({ clients });
}
