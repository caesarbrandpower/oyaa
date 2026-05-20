// components/custom/ChatPage.jsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import TaskButtons from './TaskButtons';
import ChatInput from './ChatInput';
import { DOCUMENT_OUTPUT_TYPES } from '@/lib/custom-prompts';

function looksLikePastedTranscript(text) {
  if (text.length < 500) return false;
  const headings = (text.match(/^#{1,3}\s/gm) || []).length;
  if (headings > 1) return false;
  const mdChars = (text.match(/[*#`[\]]/g) || []).length;
  return mdChars / text.length < 0.03;
}

function looksLikeDocument(content) {
  if (!content || content.length < 300) return false;
  const headings = content.match(/^#{1,3}\s+.+$/gm) || [];
  if (headings.length >= 2) return true;
  // Ook documenten met bold-sectiekoppen detecteren (bijv. **In het kort** of **Actiepunten**)
  const boldSections = content.match(/^\*\*[^*\n]{2,50}\*\*/gm) || [];
  return boldSections.length >= 3 && content.length > 500;
}
import DocumentView from './DocumentView';
import TaskSidePanel from './TaskSidePanel';
import RecordingButton from './RecordingButton';

export default function ChatPage({ user, tenant, initialThreads, initialPrefill, projects = [] }) {
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState(initialThreads);
  const [activeThread, setActiveThread] = useState(null);
  const activeThreadRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const messagesRef = useRef([]); // stabiele referentie voor gebruik in useCallback
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
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  // After a document is generated, fetch a smart title and update thread
  useEffect(() => {
    if (!pendingTitleGen) return;
    const { threadId, content, outputType, userMsgId, fallbackTitle } = pendingTitleGen;
    setPendingTitleGen(null);
    fetch('/api/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, content, outputType }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const title = data?.title || fallbackTitle;
        if (!title) return;
        if (activeThreadRef.current?.id === threadId) {
          const updated = { ...activeThreadRef.current, title };
          activeThreadRef.current = updated;
          setActiveThread(updated);
        }
        setThreads(prev => prev.map(t => t.id === threadId ? { ...t, title } : t));
        if (userMsgId) {
          setMessages(prev => prev.map(m =>
            m.id === userMsgId ? { ...m, content: title } : m
          ));
        }
      })
      .catch(() => {});
  }, [pendingTitleGen]);

  // Houd messagesRef synchroon — gebruikt door de stabiele handleSend useCallback
  useEffect(() => { messagesRef.current = messages; }, [messages]);

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

  async function saveTitle() {
    setTitleEditing(false);
    const newTitle = titleDraft.trim();
    if (!newTitle || !activeThreadRef.current || newTitle === activeThreadRef.current.title) return;
    await fetch(`/api/threads/${activeThreadRef.current.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    const updated = { ...activeThreadRef.current, title: newTitle };
    setActiveThreadBoth(updated);
    setThreads((prev) => prev.map((t) => t.id === updated.id ? { ...t, title: newTitle } : t));
  }

  function handleRenameThread(threadId, newTitle) {
    setThreads((prev) => prev.map((t) => t.id === threadId ? { ...t, title: newTitle } : t));
    if (activeThreadRef.current?.id === threadId) {
      setActiveThreadBoth({ ...activeThreadRef.current, title: newTitle });
    }
  }

  // ?thread=id param — open thread direct na navigatie (bijv. vanuit RecordingButton)
  useEffect(() => {
    const threadParam = searchParams?.get('thread');
    if (!threadParam) return;
    // Verwijder param uit URL zonder reload
    const url = new URL(window.location.href);
    url.searchParams.delete('thread');
    window.history.replaceState({}, '', url.toString());

    async function loadThread() {
      const { createClient } = await import('@/lib/supabase-browser');
      const supabase = createClient();
      const { data: thread } = await supabase
        .from('threads')
        .select('id, title, output_type, created_at, updated_at, audio_url')
        .eq('id', threadParam)
        .single();
      if (!thread) return;

      const { data: msgs } = await supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true });

      setActiveThreadBoth(thread);
      setThreads((prev) => prev.some((t) => t.id === thread.id) ? prev : [thread, ...prev]);
      const SEARCH_IDS = new Set(['location-search', 'supplier-search']);
      const isDoc = thread.output_type
        ? (DOCUMENT_OUTPUT_TYPES.has(thread.output_type) || !SEARCH_IDS.has(thread.output_type))
        : false;
      let firstUserReplaced = false;
      setMessages((msgs ?? []).map((m) => {
        const base = { ...m, attachments: [] };
        if (m.role === 'assistant') return { ...base, isDocument: isDoc || looksLikeDocument(m.content), streaming: false };
        if (isDoc && !firstUserReplaced && m.role === 'user' && thread.title) {
          firstUserReplaced = true;
          return { ...base, content: thread.title };
        }
        return base;
      }));
    }
    loadThread();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleDeleteThread(threadId) {
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    if (activeThreadRef.current?.id === threadId) {
      handleNewThread();
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

    const SEARCH_IDS = new Set(['location-search', 'supplier-search']);
    const isDoc = thread.output_type
      ? (DOCUMENT_OUTPUT_TYPES.has(thread.output_type) || !SEARCH_IDS.has(thread.output_type))
      : false;
    let firstUserReplaced = false;
    const enriched = (data ?? []).map(msg => {
      if (msg.role === 'assistant') return { ...msg, isDocument: isDoc || looksLikeDocument(msg.content), streaming: false };
      if (isDoc && !firstUserReplaced && msg.role === 'user' && thread.title) {
        firstUserReplaced = true;
        return { ...msg, content: thread.title };
      }
      return msg;
    });
    setMessages(enriched);
    setSendingState(false);
  }

  const handleSend = useCallback(
    async (messageText, outputType = null, taskLabel = null, displayText = null, client = null, imageAttachments = [], transcriptAttachments = []) => {
      if (sendingRef.current) return;
      const userMsgId = 'user-' + Date.now();
      const isPastedTranscript = !displayText && !taskLabel && looksLikePastedTranscript(messageText);
      const userMsg = {
        id: userMsgId,
        role: 'user',
        content: displayText || taskLabel || messageText,
        created_at: new Date().toISOString(),
        attachments: [
          ...imageAttachments.map((a) => ({ type: 'image', filename: a.filename })),
          ...transcriptAttachments.map((a) => ({ type: 'transcript', filename: a.filename, content: a.content })),
        ],
        pastedTranscript: isPastedTranscript,
      };
      setMessages((prev) => [...prev, userMsg]);
      setSendingState(true);

      const placeholderId = 'streaming-' + Date.now();
      const SEARCH_IDS_PLACEHOLDER = new Set(['location-search', 'supplier-search']);
      const effectiveType = outputType ?? activeThreadRef.current?.output_type ?? null;
      const prevHasDoc = messagesRef.current.some(
        m => m.role === 'assistant' && m.isDocument === true
      );
      const placeholderIsDoc = prevHasDoc || (effectiveType
        ? (DOCUMENT_OUTPUT_TYPES.has(effectiveType) || !SEARCH_IDS_PLACEHOLDER.has(effectiveType))
        : false);
      setMessages((prev) => [
        ...prev,
        { id: placeholderId, role: 'assistant', streaming: true, streamContent: '', isDocument: placeholderIsDoc, content: '' },
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
            imageAttachments,
            prevHasDoc,
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
              const SEARCH_IDS_DONE = new Set(['location-search', 'supplier-search']);
              const threadOutputType = activeThreadRef.current?.output_type;
              const threadIsDoc = threadOutputType
                ? (DOCUMENT_OUTPUT_TYPES.has(threadOutputType) || !SEARCH_IDS_DONE.has(threadOutputType))
                : false;
              const finalIsDocument = isDocument || threadIsDoc || looksLikeDocument(event.content);
              const finalMsg = {
                id: event.messageId,
                role: 'assistant',
                content: event.content,
                streaming: false,
                isDocument: finalIsDocument,
                created_at: new Date().toISOString(),
              };
              setMessages((prev) => {
                const updated = prev.map(m => m.id === placeholderId ? finalMsg : m);
                if (!finalIsDocument) return updated;
                const additions = [{
                  id: 'followup-' + Date.now(),
                  role: 'assistant',
                  type: 'followup',
                  content: 'Wil je iets aanpassen? Typ het hier, of open het document voor de markeringen.',
                  streaming: false,
                  local: true,
                  created_at: new Date().toISOString(),
                }];
                if (client === null && event.detectedClient !== undefined) {
                  const clientMsg = event.detectedClient
                    ? `Ik sla dit op onder ${event.detectedClient}. Klopt dat, of wil je een andere map?`
                    : 'Ik sla dit op onder Overige. Wil je het ergens anders kwijt?';
                  additions.push({
                    id: 'client-msg-' + Date.now(),
                    role: 'assistant',
                    content: clientMsg,
                    streaming: false,
                    local: true,
                    created_at: new Date().toISOString(),
                  });
                }
                return [...updated, ...additions];
              });
              setSendingState(false);
              if (finalIsDocument && activeThreadRef.current?.id) {
                setPendingTitleGen({
                  threadId: activeThreadRef.current.id,
                  content: event.content,
                  outputType,
                  userMsgId,
                  fallbackTitle: displayText || taskLabel,
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

  function handleTranscriptReady() {
    // Geen actie — tussenstap vervalt volledig
  }

  const SEARCH_IDS_SET = new Set(['location-search', 'supplier-search']);

  const isEmptyState = messages.length === 0 && !sending;

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return 200;
    const saved = parseInt(localStorage.getItem('sidebar-width') || '', 10);
    return (saved >= 160 && saved <= 320) ? saved : 200;
  });

  function startResize(e) {
    e.preventDefault();
    const startX = e.clientX;
    let w = sidebarWidth;
    function onMove(e) {
      w = Math.min(320, Math.max(160, sidebarWidth + e.clientX - startX));
      setSidebarWidth(w);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      localStorage.setItem('sidebar-width', String(w));
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

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
        style={{ width: sidebarWidth }}
        className={`fixed inset-y-0 left-0 z-40 bg-[#111111] transition-transform duration-200 lg:relative lg:translate-x-0 shrink-0 ${
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
          onRenameThread={handleRenameThread}
          onDeleteThread={handleDeleteThread}
          projects={projects}
        />
      </aside>

      {/* Drag handle sidebar resize — alleen desktop */}
      <div
        onMouseDown={startResize}
        className="hidden lg:block w-1.5 shrink-0 cursor-col-resize group/resize relative"
        title="Sleep om sidebar te resizen"
      >
        <div className="absolute inset-y-0 left-0 w-px bg-white/[0.06] group-hover/resize:bg-orange/40 transition-colors" />
      </div>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Hoofdgebied */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden" style={{ zoom: 1.1 }}>
        {/* Header — altijd zichtbaar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-white/40 hover:text-white/70 transition-colors"
            aria-label="Menu openen"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center min-w-0 mx-2">
            {activeThread && (
              titleEditing ? (
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTitle();
                    if (e.key === 'Escape') setTitleEditing(false);
                  }}
                  onBlur={saveTitle}
                  autoFocus
                  className="w-full bg-transparent text-[13px] font-medium text-white outline-none border-b border-white/[0.25] py-0.5 truncate"
                />
              ) : (
                <button
                  onClick={() => { setTitleDraft(activeThread.title || ''); setTitleEditing(true); }}
                  className="text-[13px] font-medium text-white/50 hover:text-white/80 transition-colors truncate max-w-full text-left"
                  title="Klik om te hernoemen"
                >
                  {activeThread.title}
                </button>
              )
            )}
          </div>
          <RecordingButton />
        </header>

        {/* Audio player — zichtbaar als de thread een opname heeft */}
        {!isEmptyState && activeThread?.audio_url && (
          <div className="shrink-0 px-4 md:px-8 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="max-w-3xl mx-auto">
              <p className="text-[10px] font-semibold tracking-[0.10em] uppercase text-white/25 mb-2">Opname</p>
              <audio
                controls
                src={activeThread.audio_url}
                className="w-full h-9"
                style={{ accentColor: '#f04800' }}
              />
            </div>
          </div>
        )}

        {/* Chat content */}
        <div className="flex-1 overflow-y-auto">
          {isEmptyState ? (
            <div className="flex items-center justify-center min-h-full">
            <div className="w-full max-w-2xl px-4 md:px-8 py-12">
              <h1 className="font-[family-name:var(--font-lexend)] text-2xl md:text-3xl font-bold text-white mb-8">
                Hoi {user.firstName ? user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1).toLowerCase() : ''}. Wat ga je vandaag maken?
              </h1>
              <ChatInput onSend={(text, opts) => handleSend(text, null, null, null, null, opts?.imageAttachments ?? [], opts?.transcriptAttachments ?? [])} disabled={sending} prefill={chatPrefill} onTranscriptReady={handleTranscriptReady} />
              {outputTypes.length > 0 && (
                <div className="mt-6">
                  <TaskButtons outputTypes={outputTypes} onTaskClick={handleTaskClick} />
                </div>
              )}
            </div>
            </div>
          ) : (
            <MessageList messages={messages} sending={sending} onOpenDocument={handleOpenDocument} />
          )}
        </div>

        {/* Input onderaan (alleen als er al berichten zijn) */}
        {!isEmptyState && (
          <div className="shrink-0 border-t border-white/[0.06] px-4 md:px-8 py-4">
            <div className="max-w-3xl mx-auto">
              <ChatInput onSend={(text, opts) => handleSend(text, null, null, null, null, opts?.imageAttachments ?? [], opts?.transcriptAttachments ?? [])} disabled={sending} prefill={chatPrefill} onTranscriptReady={handleTranscriptReady} />
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
