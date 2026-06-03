// components/custom/ChatPage.jsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import TaskButtons from './TaskButtons';
import ChatInput from './ChatInput';
import { DOCUMENT_OUTPUT_TYPES, OUTPUT_TYPE_INFO } from '@/lib/custom-prompts';

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
  // activeDocument: null | { content, outputType, title, client, extras }
  const [briefingExtras, setBriefingExtras] = useState({});
  // briefingExtras: { [messageId]: { photos: [{url, name}], links: [{label, url}] } }
  const [chatPrefill, setChatPrefill] = useState(
    initialPrefill ? { text: initialPrefill, id: Date.now() } : null
  );
  // chatPrefill: null | { text: string, id: number }
  const [activeTask, setActiveTask] = useState(null);
  // activeTask: null | task object from enabled_output_types
  const [pendingTitleGen, setPendingTitleGen] = useState(null);
  // pendingTitleGen: null | { threadId, content, outputType }
  const pendingWizardPhotosRef = useRef([]);
  // pendingWizardPhotosRef: foto's van wizard stap 2, tijdelijk opgeslagen tot messageId bekend is
  const pendingConfirmationRef = useRef(null);
  // pendingConfirmationRef: { suggestion, messageText, outputType, taskLabel, displayText, imageAttachments }
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  // After a document is generated, fetch a smart title and update thread
  useEffect(() => {
    if (!pendingTitleGen) return;
    const { threadId, content, outputType, outputTypeLabel, userMsgId, fallbackTitle } = pendingTitleGen;
    setPendingTitleGen(null);
    fetch('/api/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, content, outputType, outputTypeLabel }),
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
        .select('id, title, output_type, client, project, field_briefing_extras, created_at, updated_at, audio_url')
        .eq('id', threadParam)
        .single();
      if (!thread) return;

      const { data: msgs } = await supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true });

      setActiveThreadBoth(thread);
      setBriefingExtras(thread.field_briefing_extras || {});
      setThreads((prev) => prev.some((t) => t.id === thread.id) ? prev : [thread, ...prev]);
      const SEARCH_IDS = new Set(['location-search', 'supplier-search']);
      const isDoc = thread.output_type
        ? (DOCUMENT_OUTPUT_TYPES.has(thread.output_type) || !SEARCH_IDS.has(thread.output_type))
        : false;
      let firstUserReplaced = false;
      setMessages((msgs ?? []).map((m) => {
        const base = { ...m, attachments: [] };
        if (m.role === 'assistant') return { ...base, isDocument: isDoc || looksLikeDocument(m.content), streaming: false, output_type: thread.output_type };
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
    const ot = msg.output_type ?? activeThreadRef.current?.output_type ?? null;
    const otLabel = outputTypes.find(t => t.id === ot)?.label ?? null;
    const threadFromList = threads.find(t => t.id === activeThreadRef.current?.id);
    setActiveDocument({
      content: msg.content,
      outputType: ot,
      outputTypeLabel: otLabel,
      title: null,
      client: threadFromList?.client ?? activeThreadRef.current?.client ?? null,
      project: threadFromList?.project ?? activeThreadRef.current?.project ?? null,
      extras: briefingExtras[msg.id] ?? null,
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
    setBriefingExtras({});
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
    const [{ data }, { data: threadData }] = await Promise.all([
      supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('threads')
        .select('field_briefing_extras')
        .eq('id', thread.id)
        .single(),
    ]);
    setBriefingExtras(threadData?.field_briefing_extras || {});

    const SEARCH_IDS = new Set(['location-search', 'supplier-search']);
    const isDoc = thread.output_type
      ? (DOCUMENT_OUTPUT_TYPES.has(thread.output_type) || !SEARCH_IDS.has(thread.output_type))
      : false;
    let firstUserReplaced = false;
    const enriched = (data ?? []).map(msg => {
      if (msg.role === 'assistant') return { ...msg, isDocument: isDoc || looksLikeDocument(msg.content), streaming: false, output_type: thread.output_type };
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
    async (messageText, outputType = null, taskLabel = null, displayText = null, client = null, imageAttachments = [], transcriptAttachments = [], clientConfirmed = false, wizardProject = null, textAttachments = []) => {
      if (sendingRef.current) return;

      // Bevestigingsflow: gebruiker reageert op klantnaam-bevestiging
      let isConfirmationResponse = false;
      if (pendingConfirmationRef.current) {
        const pending = pendingConfirmationRef.current;
        pendingConfirmationRef.current = null;
        const userResponse = messageText.trim();
        const isYes = /^(ja|yes|jep|yep|ok|okay|klopt|correct)$/i.test(userResponse);
        messageText = pending.messageText;
        outputType = pending.outputType;
        taskLabel = pending.taskLabel;
        displayText = pending.displayText;
        // fuzzy: ja → gebruik suggestion, anders → gebruik userResponse als naam
        // new_client: ja → gebruik originalName, anders → gebruik userResponse als gecorrigeerde naam
        if (pending.confirmType === 'new_client') {
          client = isYes ? pending.originalName : userResponse;
        } else {
          client = isYes ? pending.suggestion : userResponse;
        }
        imageAttachments = pending.imageAttachments;
        clientConfirmed = true;
        isConfirmationResponse = true;
      }
      const userMsgId = 'user-' + Date.now();
      const isPastedTranscript = !displayText && !taskLabel && textAttachments.length === 0 && transcriptAttachments.length === 0 && looksLikePastedTranscript(messageText);
      // Strip bestandsinhoud ([Bijlage: ...] en [Transcript: ...]) uit het zichtbare bericht
      const visibleContent = displayText || taskLabel || messageText.split('\n\n[Bijlage:')[0].split('\n\n[Transcript:')[0].trim();
      const userMsg = {
        id: userMsgId,
        role: 'user',
        content: visibleContent,
        created_at: new Date().toISOString(),
        attachments: [
          ...imageAttachments.map((a) => ({ type: 'image', filename: a.filename })),
          ...transcriptAttachments.map((a) => ({ type: 'transcript', filename: a.filename, content: a.content })),
          ...textAttachments.map((a) => ({ type: 'text', filename: a.filename })),
        ],
        pastedTranscript: isPastedTranscript,
      };
      if (!isConfirmationResponse) {
        setMessages((prev) => [...prev, userMsg]);
      }
      setSendingState(true);

      // Fix 4C: veldbriefing foto-interceptor
      const currentOutputType = outputType ?? activeThreadRef.current?.output_type ?? null;
      if (currentOutputType === 'field-briefing' && /foto|fotos|foto's|afbeelding|afbeeldingen|upload|toevoeg|bijvoeg/i.test(messageText)) {
        setMessages(prev => [...prev, {
          id: 'local-' + Date.now(),
          role: 'assistant',
          content: "Foto's toevoegen doe je via de knop in het veldbriefing-formulier hieronder.",
          streaming: false,
          local: true,
          created_at: new Date().toISOString(),
        }]);
        setSendingState(false);
        return;
      }

      const placeholderId = 'streaming-' + Date.now();
      const SEARCH_IDS_PLACEHOLDER = new Set(['location-search', 'supplier-search']);
      const effectiveType = outputType ?? activeThreadRef.current?.output_type ?? null;
      const prevHasDoc = messagesRef.current.some(
        m => m.role === 'assistant' && m.isDocument === true
      );
      const placeholderIsDoc = prevHasDoc || (effectiveType
        ? (DOCUMENT_OUTPUT_TYPES.has(effectiveType) || !SEARCH_IDS_PLACEHOLDER.has(effectiveType))
        : false);
      const bufferedStream = textAttachments.length > 0 || transcriptAttachments.length > 0;
      setMessages((prev) => [
        ...prev,
        { id: placeholderId, role: 'assistant', streaming: true, streamContent: '', isDocument: placeholderIsDoc, content: '', bufferedStream },
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
            clientConfirmed,
            imageAttachments,
            prevHasDoc,
            project: wizardProject ?? null,
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
                prev.map(m => m.id === placeholderId
                  ? { ...m, isDocument, ...(isDocument ? { bufferedStream: true } : {}) }
                  : m)
              );

              if (!activeThreadRef.current) {
                const newThread = {
                  id: event.threadId,
                  title: displayText || taskLabel || messageText.slice(0, 60),
                  output_type: outputType,
                  client: client ?? null,
                  project: null,
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
              const finalIsDocument = isDocument || looksLikeDocument(event.content);
              const finalMsg = {
                id: event.messageId,
                role: 'assistant',
                content: event.content,
                streaming: false,
                isDocument: finalIsDocument,
                bufferedStream: bufferedStream || finalIsDocument,
                output_type: outputType ?? activeThreadRef.current?.output_type ?? null,
                created_at: new Date().toISOString(),
              };
              setMessages((prev) => {
                const updated = prev.map(m => m.id === placeholderId ? finalMsg : m);
                if (!finalIsDocument) return updated;
                const additions = [];
              if (client === null && event.detectedClient !== undefined) {
                  const effectiveClientName = event.detectedClient || client;
                  const clientMsg = effectiveClientName
                    ? `Ik sla dit op in de map ${effectiveClientName}. Wil je het ergens anders kwijt?`
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
              // detectedClient/Project buiten setMessages updater — nooit side effects in een pure updater
              // Altijd client én project samen opslaan — nooit los van elkaar
              const currentThreadId = activeThreadRef.current?.id;
              if (currentThreadId) {
                const hasClient = event.detectedClient !== undefined;
                const hasProject = event.detectedProject != null; // != dekt zowel null als undefined
                if (hasClient || hasProject) {
                  const newClient = hasClient ? event.detectedClient : (activeThreadRef.current?.client ?? null);
                  const newProject = event.detectedProject ?? null;
                  setActiveThreadBoth({ ...activeThreadRef.current, client: newClient, project: newProject });
                  setThreads((prev) => prev.map((t) => t.id === currentThreadId
                    ? { ...t, client: newClient, project: newProject }
                    : t));
                }
              }
              // Auto-titel: "[Klant] — [Type]" zodra client + outputType bekend zijn, vóór document-generatie
              if (!finalIsDocument && currentThreadId) {
                const effectiveClient = client || activeThreadRef.current?.client;
                const effectiveOutputType = outputType || activeThreadRef.current?.output_type;
                const typeLabel = effectiveOutputType ? OUTPUT_TYPE_INFO[effectiveOutputType]?.label : null;
                if (effectiveClient && typeLabel) {
                  const newTitle = `${effectiveClient} — ${typeLabel}`;
                  fetch(`/api/threads/${currentThreadId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newTitle }),
                  }).catch(() => {});
                  setThreads(prev => prev.map(t => t.id === currentThreadId ? { ...t, title: newTitle } : t));
                  if (activeThreadRef.current?.id === currentThreadId) {
                    const updated = { ...activeThreadRef.current, title: newTitle };
                    activeThreadRef.current = updated;
                    setActiveThread(updated);
                  }
                }
              }
              setSendingState(false);
              // Wizard-foto's koppelen aan het gegenereerde document-bericht
              if (finalIsDocument && pendingWizardPhotosRef.current.length > 0) {
                const wizardPhotos = pendingWizardPhotosRef.current.map(a => ({
                  url: `data:${a.mediaType};base64,${a.data}`,
                  name: a.filename,
                }));
                setBriefingExtras(prev => ({
                  ...prev,
                  [event.messageId]: { photos: wizardPhotos, links: [] },
                }));
                pendingWizardPhotosRef.current = [];
              }
              if (finalIsDocument && activeThreadRef.current?.id) {
                const outputTypeLabel = outputTypes.find(t => t.id === outputType)?.label ?? null;
                setPendingTitleGen({
                  threadId: activeThreadRef.current.id,
                  content: event.content,
                  outputType,
                  outputTypeLabel,
                  userMsgId,
                  fallbackTitle: displayText || taskLabel,
                });
              }
            } else if (event.type === 'confirm') {
              const confirmMessage = event.confirmType === 'new_client'
                ? `We slaan **${event.name}** op als nieuwe klantnaam. Klopt de schrijfwijze? Typ *ja* om te bevestigen of geef de juiste naam op.`
                : `Bedoel je **${event.suggestion}**? Bevestig met *ja* of geef de juiste klantnaam op.`;
              setMessages((prev) => [
                ...prev.filter(m => m.id !== placeholderId),
                {
                  id: 'confirm-' + Date.now(),
                  role: 'assistant',
                  content: confirmMessage,
                  streaming: false,
                  local: true,
                  created_at: new Date().toISOString(),
                },
              ]);
              pendingConfirmationRef.current = {
                confirmType: event.confirmType ?? 'fuzzy',
                suggestion: event.suggestion ?? null,
                originalName: event.name ?? null,
                messageText,
                outputType,
                taskLabel,
                displayText,
                imageAttachments,
              };
              setSendingState(false);
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

  function handleTaskGenerate(prompt, outputType, taskLabel, displayText, client, imageAttachments = [], wizardProject = null) {
    setActiveTask(null);
    // Sla wizard-foto's op in ref zodat handleSend ze kan toevoegen aan briefingExtras na genereren
    pendingWizardPhotosRef.current = imageAttachments;
    handleNewThread(); // sets activeThreadRef.current = null synchronously
    handleSend(prompt, outputType, taskLabel, displayText, client, imageAttachments, [], false, wizardProject);
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

  // --- Opname loading state ---
  const [recordingPending, setRecordingPending] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const recordingProgressRef = useRef(null);

  function handleRecordingStart() {
    setRecordingPending(true);
    setRecordingProgress(0);
    // Simuleer voortgang: 0 → 88% in ~55 seconden
    recordingProgressRef.current = setInterval(() => {
      setRecordingProgress(p => {
        const next = p + (88 / 55);
        return next >= 88 ? 88 : next;
      });
    }, 1000);
  }

  async function handleRecordingComplete({ threadId, title, transcript }) {
    clearInterval(recordingProgressRef.current);
    setRecordingProgress(100);

    const { createClient } = await import('@/lib/supabase-browser');
    const supabase = createClient();
    const { data: thread } = await supabase
      .from('threads')
      .select('id, title, output_type, client, project, field_briefing_extras, created_at, updated_at, audio_url')
      .eq('id', threadId)
      .single();

    if (thread) {
      setActiveThreadBoth(thread);
      setBriefingExtras(thread.field_briefing_extras || {});
      setThreads(prev => prev.some(t => t.id === thread.id) ? prev : [thread, ...prev]);
    }

    // Toon transcript als user-bericht (direct uit response, niet streaming)
    setMessages([{
      id: 'recording-' + threadId,
      role: 'user',
      content: transcript,
      created_at: new Date().toISOString(),
      attachments: [],
      isRecordingTranscript: true,
    }]);

    setTimeout(() => {
      setRecordingPending(false);
      setRecordingProgress(0);
    }, 300);
  }

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
        client={activeDocument.client ?? null}
        project={activeDocument.project ?? null}
        tenant={tenant}
        extras={activeDocument.extras ?? null}
        outputType={activeDocument.outputType ?? null}
        outputTypeLabel={activeDocument.outputTypeLabel ?? null}
        onClose={handleCloseDocument}
        onImprove={handleCloseDocument}
      />
    )}
    <div className="flex h-full overflow-hidden">
      {/* Desktop linkerkolom — logo + sidebar, één border-r */}
      <div
        className="hidden lg:flex flex-col shrink-0 border-r border-white/[0.06]"
        style={{ width: sidebarWidth }}
      >
        <div className="flex items-center px-4 h-16 shrink-0 border-b border-white/[0.06]">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name} className="h-6 w-auto object-contain object-left" />
          ) : (
            <span className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.2em] uppercase text-orange">
              {tenant?.name ?? 'Waybetter'}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
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
        </div>
      </div>

      {/* Drag handle sidebar resize — alleen desktop */}
      <div
        onMouseDown={startResize}
        className="hidden lg:block w-1.5 shrink-0 cursor-col-resize group/resize relative border-b border-white/[0.06]"
        title="Sleep om sidebar te resizen"
      >
        <div className="absolute inset-y-0 left-0 w-px bg-transparent group-hover/resize:bg-orange/40 transition-colors" />
      </div>

      {/* Mobile sidebar — fixed overlay */}
      <aside
        style={{ width: sidebarWidth }}
        className={`fixed inset-y-0 left-0 z-40 lg:hidden bg-[#111111] transition-transform duration-200 ${
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

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Rechterkolom — header + content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-white/[0.06]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-white/40 hover:text-white/70 transition-colors"
            aria-label="Menu openen"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center min-w-0">
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
          <RecordingButton onRecordingStart={handleRecordingStart} onRecordingComplete={handleRecordingComplete} />
        </div>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ zoom: 1.1 }}>

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
          {recordingPending ? (
            /* Opname wordt verwerkt — laadscherm */
            <div className="flex items-center justify-center min-h-full">
              <div className="w-full max-w-md px-4 md:px-8 py-12 text-center">
                <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-orange/70 animate-spin mx-auto mb-6" />
                <p className="text-[15px] font-medium text-white/70 mb-2">Transcript wordt gemaakt...</p>
                <p className="text-[12px] text-white/30 mb-6">Dit duurt gewoonlijk 20 tot 60 seconden.</p>
                <div className="w-full bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full bg-orange transition-all duration-1000"
                    style={{ width: `${recordingProgress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : isEmptyState ? (
            <div className="flex items-center justify-center min-h-full">
            <div className="w-full max-w-2xl px-4 md:px-8 py-12">
              <h1 className="font-[family-name:var(--font-lexend)] text-[22px] font-medium text-white/60 mb-8">
                Hoi {user.firstName ? user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1).toLowerCase() : ''}. Hoe kan ik je helpen?
              </h1>
              <ChatInput onSend={(text, opts) => handleSend(text, null, null, null, null, opts?.imageAttachments ?? [], opts?.transcriptAttachments ?? [], false, null, opts?.textAttachments ?? [])} disabled={sending} prefill={chatPrefill} onTranscriptReady={handleTranscriptReady} />
              {outputTypes.length > 0 && (
                <div className="mt-6">
                  <TaskButtons outputTypes={outputTypes} onTaskClick={handleTaskClick} />
                </div>
              )}
            </div>
            </div>
          ) : (
            <>
            <MessageList
              messages={messages}
              sending={sending}
              onOpenDocument={handleOpenDocument}
              briefingExtras={briefingExtras}
              tenant={tenant}
              threadClient={threads.find(t => t.id === activeThread?.id)?.client ?? activeThread?.client ?? null}
              threadProject={threads.find(t => t.id === activeThread?.id)?.project ?? activeThread?.project ?? null}
              outputTypes={outputTypes}
              onExtrasChange={(messageId, extras) => {
                setBriefingExtras(prev => {
                  const updated = { ...prev, [messageId]: extras };
                  if (activeThreadRef.current?.id) {
                    fetch(`/api/threads/${activeThreadRef.current.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ field_briefing_extras: updated }),
                    }).catch(() => {});
                  }
                  return updated;
                });
              }}
            />
            {/* Na transcript van opname: directe actieknoppen */}
            {outputTypes.length > 0 && activeThread?.audio_url && messages.length > 0 && messages.every(m => m.role === 'user') && (
              <div className="px-4 md:px-8 py-6">
                <div className="max-w-3xl mx-auto">
                  <p className="text-[13px] text-white/40 mb-4">Wat wil je hiermee maken?</p>
                  <TaskButtons outputTypes={outputTypes} onTaskClick={handleTaskClick} />
                </div>
              </div>
            )}
            </>
          )}
        </div>

        {/* Input onderaan (alleen als er al berichten zijn en niet in laadscherm) */}
        {!isEmptyState && !recordingPending && (
          <div className="shrink-0 border-t border-white/[0.06] px-4 md:px-8 py-4">
            <div className="max-w-3xl mx-auto">
              <ChatInput onSend={(text, opts) => handleSend(text, null, null, null, null, opts?.imageAttachments ?? [], opts?.transcriptAttachments ?? [], false, null, opts?.textAttachments ?? [])} disabled={sending} prefill={chatPrefill} onTranscriptReady={handleTranscriptReady} />
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
    </>
  );
}
