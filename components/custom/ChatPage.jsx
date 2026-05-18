// components/custom/ChatPage.jsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import TaskButtons from './TaskButtons';
import ChatInput from './ChatInput';
import { DOCUMENT_OUTPUT_TYPES } from '@/lib/custom-prompts';
import DocumentView from './DocumentView';
import TaskSidePanel from './TaskSidePanel';

export default function ChatPage({ user, tenant, initialThreads, initialPrefill }) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeThread, setActiveThread] = useState(null);
  const activeThreadRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef(null);
  const [activeDocument, setActiveDocument] = useState(null);
  // activeDocument: null | { content, outputType, title }
  const [chatPrefill, setChatPrefill] = useState(
    initialPrefill ? { text: initialPrefill, id: Date.now() } : null
  );
  // chatPrefill: null | { text: string, id: number }
  const [activeTask, setActiveTask] = useState(null);
  // activeTask: null | task object from enabled_output_types
  const [pendingTitleGen, setPendingTitleGen] = useState(null);
  // pendingTitleGen: null | { threadId, content, outputType }

  // After a document is generated, fetch a smart title and update thread
  useEffect(() => {
    if (!pendingTitleGen) return;
    const { threadId, content, outputType, userMsgId } = pendingTitleGen;
    setPendingTitleGen(null);
    fetch('/api/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, content, outputType }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const title = data?.title;
        if (!title) return;
        if (activeThreadRef.current?.id === threadId) {
          const updated = { ...activeThreadRef.current, title };
          activeThreadRef.current = updated;
          setActiveThread(updated);
        }
        setThreads(prev => prev.map(t => t.id === threadId ? { ...t, title } : t));
        // Update user message content to match smart title
        if (userMsgId) {
          setMessages(prev => prev.map(m =>
            m.id === userMsgId ? { ...m, content: title } : m
          ));
        }
      })
      .catch(() => {});
  }, [pendingTitleGen]);

  const outputTypes = Array.isArray(tenant?.enabled_output_types)
    ? tenant.enabled_output_types.filter((t) => typeof t === 'object' && t.id)
    : [];

  function setSendingState(value) {
    sendingRef.current = value;
    setSending(value);
  }

  // Always update ref and state together — ref is read by handleSend (stable useCallback)
  function setActiveThreadBoth(thread) {
    activeThreadRef.current = thread;
    setActiveThread(thread);
  }

  function handleOpenDocument(msg) {
    setActiveDocument({
      content: msg.content,
      outputType: msg.output_type ?? activeThreadRef.current?.output_type ?? null,
      title: null,
    });
  }

  function handleCloseDocument(prefillText) {
    setActiveDocument(null);
    if (typeof prefillText === 'string' && prefillText) {
      setChatPrefill({ text: prefillText, id: Date.now() });
    }
  }

  function handleNewThread() {
    abortRef.current?.abort();
    setActiveThreadBoth(null);
    setMessages([]);
    setSendingState(false);
    setSidebarOpen(false);
  }

  async function handleSelectThread(thread) {
    abortRef.current?.abort();
    setActiveThreadBoth(thread);
    setSidebarOpen(false);
    setSendingState(true);

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
    setSendingState(false);
  }

  const handleSend = useCallback(
    async (messageText, outputType = null, taskLabel = null, displayText = null, client = null) => {
      if (sendingRef.current) return;
      const userMsgId = 'user-' + Date.now();
      const userMsg = {
        id: userMsgId,
        role: 'user',
        content: displayText || messageText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setSendingState(true);

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
            threadId: activeThreadRef.current?.id ?? null,
            message: messageText,
            outputType: outputType ?? activeThreadRef.current?.output_type ?? null,
            taskLabel,
            client,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          setMessages((prev) => prev.filter(m => m.id !== placeholderId));
          setSendingState(false);
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

              if (!activeThreadRef.current) {
                const newThread = {
                  id: event.threadId,
                  title: displayText || taskLabel || messageText.slice(0, 60),
                  output_type: outputType,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                setActiveThreadBoth(newThread);
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
              setSendingState(false);
              if (isDocument && activeThreadRef.current?.id) {
                setPendingTitleGen({
                  threadId: activeThreadRef.current.id,
                  content: event.content,
                  outputType,
                  userMsgId,
                });
              }
            } else if (event.type === 'error') {
              setMessages((prev) => prev.filter(m => m.id !== placeholderId));
              setSendingState(false);
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('handleSend error:', err);
        }
        // Remove placeholder on any error or abort
        setMessages((prev) => prev.filter(m => m.id !== placeholderId));
        setSendingState(false);
      }
    },
    [] // stable — reads activeThread and sending via refs (activeThreadRef, sendingRef)
  );

  function handleTaskClick(task) {
    setActiveTask(task);
  }

  function handleTaskGenerate(prompt, outputType, taskLabel, displayText, client) {
    setActiveTask(null);
    handleNewThread(); // sets activeThreadRef.current = null synchronously
    handleSend(prompt, outputType, taskLabel, displayText, client); // reads null from ref — no setTimeout needed
  }

  function handleTaskPanelClose(prefillText) {
    setActiveTask(null);
    if (prefillText) {
      setChatPrefill({ text: prefillText, id: Date.now() });
    }
  }

  const isEmptyState = messages.length === 0 && !sending;

  return (
    <>
    {activeTask && (
      <TaskSidePanel
        task={activeTask}
        onClose={handleTaskPanelClose}
        onGenerate={handleTaskGenerate}
      />
    )}
    {activeDocument && (
      <DocumentView
        content={activeDocument.content}
        onClose={handleCloseDocument}
        onImprove={handleCloseDocument}
      />
    )}
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
              <ChatInput onSend={handleSend} disabled={sending} prefill={chatPrefill} />
              {outputTypes.length > 0 && (
                <div className="mt-6">
                  <TaskButtons outputTypes={outputTypes} onTaskClick={handleTaskClick} />
                </div>
              )}
            </div>
          ) : (
            <MessageList messages={messages} sending={sending} onOpenDocument={handleOpenDocument} />
          )}
        </div>

        {/* Input onderaan (alleen als er al berichten zijn) */}
        {!isEmptyState && (
          <div className="shrink-0 border-t border-white/[0.06] px-4 md:px-8 py-4">
            <div className="max-w-3xl mx-auto">
              <ChatInput onSend={handleSend} disabled={sending} prefill={chatPrefill} />
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
