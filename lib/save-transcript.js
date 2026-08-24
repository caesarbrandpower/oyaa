// Gedeelde helper: sla een verwerkt transcript op in Supabase.
// Atomaire update op transcript_status zodat webhook en cron nooit dubbel schrijven.

import { createServiceClient } from '@/lib/supabase-server';

export async function saveTranscript(threadId, transcript) {
  const supabase = createServiceClient();

  // Alleen updaten als status nog queued/processing is — precies één aanroeper wint
  const { data: updated } = await supabase
    .from('threads')
    .update({ transcript_status: 'done', transcript_error: null })
    .eq('id', threadId)
    .in('transcript_status', ['queued', 'processing'])
    .select('id');

  if (!updated || updated.length === 0) {
    console.log(`[save-transcript] thread ${threadId} was al verwerkt, overgeslagen`);
    return false;
  }

  await supabase.from('messages').insert({
    thread_id: threadId,
    role: 'user',
    content: transcript,
    attachments: [],
  });

  console.log(`[save-transcript] transcript opgeslagen voor thread ${threadId}`);
  return true;
}
