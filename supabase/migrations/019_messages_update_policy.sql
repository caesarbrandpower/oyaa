-- supabase/migrations/019_messages_update_policy.sql
-- Voegt UPDATE-policy toe op de messages-tabel zodat de verbetermodus
-- (improveDocument=true) het bestaande assistant-bericht kan overschrijven.
-- De SELECT- en INSERT-policies bestaan al (004_threads_messages.sql);
-- alleen UPDATE ontbrak, waardoor het UPDATE-statement stilzwijgend 0 rijen bijwerkte.

create policy "Users update messages in own threads"
  on public.messages for update
  using (
    exists (
      select 1 from public.threads
      where threads.id = messages.thread_id
      and threads.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.threads
      where threads.id = messages.thread_id
      and threads.user_id = auth.uid()
    )
  );
