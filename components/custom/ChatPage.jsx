// components/custom/ChatPage.jsx
'use client';

import { useState, useCallback, useRef } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import TaskButtons from './TaskButtons';
import ChatInput from './ChatInput';
import { DOCUMENT_OUTPUT_TYPES } from '@/lib/custom-prompts';

export default function ChatPage({ user, tenant, initialThreads }) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef(null);

  const outputTypes = Array.isArray(tenant?.enabled_output_types)
    ? tenant.enabled_output_types.filter((t) => typeof t === 'object' && t.id)
    : [];

  function handleNewThread() {
    abortRef.current?.abort();
    setActiveThread(null);
    setMessages([]);
    setSending(false);
    setSidebarOpen(false);
  }

  async function handleSelectThread(thread) {
    abortRef.current?.abort();
    setActiveThread(thread);
    setSidebarOpen(false);
    setSending(true);

    const { createClient } = await import('@/lib/supabase-browser');
    const supabase = createClient();
    const { data } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true });

    const isDoc = thread.output_type ? DOCUMENT_OUTPUT_TYPES.has(thread.output_type) : false;
    const enriched = (data ?? []).map(msg =>
      msg.role === 'assistant' ? { ...msg, isDocument: isDoc, streaming: false } : msg
    );
    setMessages(enriched);
    setSending(false);
  }

  const handleSend = useCallback(
    async (messageText, outputType = null, taskLabel = null) => {
      if (sending) return;
      const userMsg = {
        id: 'user-' + Date.now(),
        role: 'user',
        content: messageText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);

      const placeholderId = 'streaming-' + Date.now();
      setMessages((prev) => [
        ...prev,
        { id: placeholderId, role: 'assistant', streaming: true, streamContent: '', isDocument: false, content: '' },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/chat-custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId: activeThread?.id ?? null,
            message: messageText,
            outputType: outputType ?? activeThread?.output_type ?? null,
            taskLabel,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          setMessages((prev) => prev.filter(m => m.id !== placeholderId));
          setSending(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let isDocument = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            let event;
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            if (event.type === 'meta') {
              isDocument = event.isDocument ?? false;

              setMessages((prev) =>
                prev.map(m => m.id === placeholderId ? { ...m, isDocument } : m)
              );

              if (!activeThread) {
                const newThread = {
                  id: event.threadId,
                  title: taskLabel || messageText.slice(0, 60),
                  output_type: outputType,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                setActiveThread(newThread);
                setThreads((prev) => [newThread, ...prev]);
              }
            } else if (event.type === 'chunk') {
              setMessages((prev) =>
                prev.map(m =>
                  m.id === placeholderId
                    ? { ...m, streamContent: (m.streamContent || '') + event.text }
                    : m
                )
              );
            } else if (event.type === 'done') {
              setMessages((prev) =>
                prev.map(m =>
                  m.id === placeholderId
                    ? {
                        id: event.messageId,
                        role: 'assistant',
                        content: event.content,
                        streaming: false,
                        isDocument,
                        created_at: new Date().toISOString(),
                      }
                    : m
                )
              );
              setSending(false);
            } else if (event.type === 'error') {
              setMessages((prev) => prev.filter(m => m.id !== placeholderId));
              setSending(false);
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('handleSend error:', err);
        }
        // Remove placeholder on any error or abort
        setMessages((prev) => prev.filter(m => m.id !== placeholderId));
        setSending(false);
      }
    },
    [activeThread]
  );

  function handleTaskClick(task) {
    handleNewThread();
    setTimeout(() => {
      handleSend(
        `Ik wil ${task.label.toLowerCase()}. Hier is mijn input:`,
        task.id,
        task.label
      );
    }, 0);
  }

  const isEmptyState = messages.length === 0 && !sending;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[200px] bg-[#111111] border-r border-white/[0.06] transition-transform duration-200 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          tenant={tenant}
          user={user}
          threads={threads}
          activeThreadId={activeThread?.id}
          onNewThread={handleNewThread}
          onSelectThread={handleSelectThread}
        />
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Hoofdgebied */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white/40 hover:text-white/70 transition-colors"
            aria-label="Menu openen"
          >
            <Menu className="w-5 h-5" />
          </button>
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name} className="h-5 w-auto object-contain" />
          ) : (
            <span className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.2em] uppercase text-orange">
              {tenant?.name ?? 'Waybetter'}
            </span>
          )}
        </header>

        {/* Chat content */}
        <div className="flex-1 overflow-y-auto">
          {isEmptyState ? (
            <div className="flex flex-col justify-center min-h-full px-4 md:px-8 py-12 max-w-3xl mx-auto w-full">
              <h1 className="font-[family-name:var(--font-lexend)] text-2xl md:text-3xl font-bold text-white mb-8">
                Hoi {user.firstName}. Wat ga je vandaag maken?
              </h1>
              <ChatInput onSend={handleSend} disabled={sending} />
              {outputTypes.length > 0 && (
                <div className="mt-6">
                  <TaskButtons outputTypes={outputTypes} onTaskClick={handleTaskClick} />
                </div>
              )}
            </div>
          ) : (
            <MessageList messages={messages} sending={sending} />
          )}
        </div>

        {/* Input onderaan (alleen als er al berichten zijn) */}
        {!isEmptyState && (
          <div className="shrink-0 border-t border-white/[0.06] px-4 md:px-8 py-4">
            <div className="max-w-3xl mx-auto">
              <ChatInput onSend={handleSend} disabled={sending} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
