// app/evaluatie/[id]/page.jsx — TIJDELIJKE DEBUG VERSIE
import { createClient } from '@/lib/supabase-server';

export default async function EvaluatiePage({ params }) {
  console.log('[EVAL] params.id:', params.id);

  // Check 1: kan de pagina de Supabase client aanmaken?
  const supabase = await createClient();
  console.log('[EVAL] supabase client created');

  // Check 2: query zonder filter om te zien of er überhaupt records zijn
  const { data: allMessages, error: allError } = await supabase
    .from('messages')
    .select('id, thread_id, created_at')
    .limit(3);

  console.log('[EVAL] allMessages:', JSON.stringify(allMessages));
  console.log('[EVAL] allError:', JSON.stringify(allError));

  // Check 3: query op thread_id
  const { id } = await params;
  const { data, error } = await supabase
    .from('messages')
    .select('id, thread_id, metadata')
    .eq('thread_id', id)
    .limit(5);

  console.log('[EVAL] thread messages:', JSON.stringify(data));
  console.log('[EVAL] thread error:', JSON.stringify(error));

  return <div>Debug: {id} — check Vercel logs</div>;
}
