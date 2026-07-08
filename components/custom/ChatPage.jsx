// components/custom/ChatPage.jsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Menu, Play, Pause, X } from 'lucide-react';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import TaskButtons from './TaskButtons';
import ChatInput from './ChatInput';
import { DOCUMENT_OUTPUT_TYPES, OUTPUT_TYPE_INFO, WIZARD_CONFIG } from '@/lib/custom-prompts';
import { buildWordBlob, fetchImageAsBuffer, fetchLogoBuffer } from '@/lib/doc-export';

const ALLDAY_NEXT_STEPS = {
  3: {
    checklist: ['Is de briefing volledig gedocumenteerd?', 'Zijn de deliverables helder afgebakend?', 'Is het budget bevestigd of onder voorbehoud?'],
    nextTask: 'allday-debrief',
    nextLabel: 'Start Debrief',
  },
  4: {
    checklist: ['Is de debrief goedgekeurd door de klant?', 'Is de scope akkoord?', 'Is de planning bevestigd?'],
    nextTask: null,
    nextLabel: null,
  },
};

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
function formatAudioTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

import DocumentView from './DocumentView';
import DocumentCard from './DocumentCard';
import TaskSidePanel from './TaskSidePanel';
import RecordingButton from './RecordingButton';

export default function ChatPage({ user, tenant, initialThreads, initialPrefill, initialThreadId = null, initialImprove = false, projects = [] }) {
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
  const [alldayNextStep, setAlldayNextStep] = useState(null);
  // alldayNextStep: null | { phase: number, client: string|null, project: string|null }
  const [chatflowPhaseState, setChatflowPhaseState] = useState(null);
  // chatflowPhaseState: null | saved handleSend args waiting for phase selection
  const [pendingTitleGen, setPendingTitleGen] = useState(null);
  // pendingTitleGen: null | { threadId, content, outputType }
  const pendingWizardPhotosRef = useRef([]);
  // pendingWizardPhotosRef: foto's van wizard stap 2, tijdelijk opgeslagen tot messageId bekend is
  const pendingConfirmationRef = useRef(null);
  // pendingConfirmationRef: { suggestion, messageText, outputType, taskLabel, displayText, imageAttachments }
  const pendingImageRef = useRef(null);
  // pendingImageRef: null | { imageAttachments } — wachtend op gebruikerskeuze (informatie uithalen / bijlage)
  const threadDocsRef = useRef([]);
  // threadDocsRef: PDF-bijlagen voor de actieve thread — persistent over meerdere beurten zodat Claude ze in turn 2 nog kan lezen
  const threadTxtAttachmentsRef = useRef([]);
  // threadTxtAttachmentsRef: txt-bijlagen als [{filename, data}] — parallel aan PDF-binaries, los van DB/combinedUserContext
  const threadTxtContextRef = useRef('');
  // threadTxtContextRef: txt-bijlageinhoud ingebed in messageText ([Bijlage: ...]) — persistent naast PDF-binaries
  const pendingDocGenRef = useRef(null);
  // pendingDocGenRef: context opgeslagen na analyse-bevestigingsvraag — bevat alles om generatie te hervatten
  const recordingSplitRef = useRef(false);
  // recordingSplitRef: true tijdens een API-call waarbij een recording-thread een nieuw document-thread aanmaakt
  const improveDocRef = useRef(!!initialImprove);
  const chunkBufferRef = useRef('');
  const streamingPlaceholderIdRef = useRef(null);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [documentTokens, setDocumentTokens] = useState({});
  // documentTokens: { [messageId]: shareToken } — bijgehouden voor Aanvullen-overschrijven

  // After a document is generated, fetch a smart title and update thread
  useEffect(() => {
    if (!pendingTitleGen) return;
    const { threadId, content, outputType, outputTypeLabel, userMsgId, fallbackTitle, evaluationCampagne } = pendingTitleGen;
    setPendingTitleGen(null);

    function applyTitle(title) {
      if (!title) return;
      if (activeThreadRef.current?.id === threadId) {
        const updated = { ...activeThreadRef.current, title };
        activeThreadRef.current = updated;
        setActiveThread(updated);
      }
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, title } : t));
      if (userMsgId) {
        setMessages(prev => prev.map(m => m.id === userMsgId ? { ...m, content: title } : m));
      }
    }

    // Evaluatie: titel direct uit campagne-veld — geen Haiku-call nodig
    if (outputType === 'evaluation' && evaluationCampagne) {
      const title = `Evaluatie — ${evaluationCampagne}`;
      applyTitle(title);
      fetch(`/api/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).catch(() => {});
      return;
    }

    fetch('/api/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, content, outputType, outputTypeLabel }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => applyTitle(data?.title || fallbackTitle))
      .catch(() => {});
  }, [pendingTitleGen]);

  // Houd messagesRef synchroon — gebruikt door de stabiele handleSend useCallback
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Flush-loop: leegt chunkBufferRef elke 30ms in één state-update voor vloeiende streaming
  useEffect(() => {
    if (!sending) return;
    const iv = setInterval(() => {
      const id = streamingPlaceholderIdRef.current;
      if (!id || !chunkBufferRef.current) return;
      const text = chunkBufferRef.current;
      chunkBufferRef.current = '';
      setMessages((prev) =>
        prev.map(m =>
          m.id === id ? { ...m, streamContent: (m.streamContent || '') + text } : m
        )
      );
    }, 30);
    return () => clearInterval(iv);
  }, [sending]);

  const outputTypes = (tenant?.tenant_config?.features?.output_types ?? [])
    .map(id => {
      const meta = OUTPUT_TYPE_INFO[id];
      return meta ? { id, ...meta } : null;
    })
    .filter(Boolean);

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
    const threadParam = initialThreadId;
    if (!threadParam) return;

    async function loadThread() {
      const { createClient } = await import('@/lib/supabase-browser');
      const supabase = createClient();
      const { data: thread } = await supabase
        .from('threads')
        .select('id, title, output_type, client, project, created_at, updated_at, audio_url, field_briefing_extras')
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
      const isDocThread = thread.output_type && thread.output_type !== 'recording'
        ? (DOCUMENT_OUTPUT_TYPES.has(thread.output_type) || !SEARCH_IDS.has(thread.output_type))
        : false;
      let firstUserReplaced = false;
      setMessages((msgs ?? []).map((m) => {
        const base = { ...m, attachments: [] };
        // isDocument vereist zowel document-achtige inhoud als een echt documenttype op de thread.
        // Vrije-chat antwoorden met rijke opmaak worden anders fout als document weergegeven.
        if (m.role === 'assistant') return { ...base, isDocument: (looksLikeDocument(m.content) && DOCUMENT_OUTPUT_TYPES.has(thread.output_type)) || (thread.output_type === 'evaluation' && m.content?.includes('```json')), streaming: false, output_type: thread.output_type };
        if (isDocThread && !firstUserReplaced && m.role === 'user' && thread.title) {
          firstUserReplaced = true;
          return { ...base, content: thread.title };
        }
        if (m.role === 'user') {
          const stripped = m.content
            .split('\n\n[Bijlage:')[0]
            .split('\n\n[Transcript:')[0]
            .split('\n\nContext:\n')[0]
            .split('\n\nInput:\n')[0]
            .trim();
          return { ...base, content: stripped || m.content };
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
      savedToken: documentTokens[msg.id] ?? null,
      messageId: msg.id,
    });
  }

  function handleCloseDocument(prefillOrObj) {
    setActiveDocument(null);
    if (prefillOrObj && typeof prefillOrObj === 'object') {
      if (prefillOrObj.isImprove) improveDocRef.current = true;
      if (prefillOrObj.prefillText) setChatPrefill({ text: prefillOrObj.prefillText, id: Date.now() });
    } else if (typeof prefillOrObj === 'string' && prefillOrObj) {
      setChatPrefill({ text: prefillOrObj, id: Date.now() });
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
    threadDocsRef.current = [];
    threadTxtAttachmentsRef.current = [];
    improveDocRef.current = false;
  }

  async function handleSelectThread(thread) {
    abortRef.current?.abort();
    threadDocsRef.current = [];
    threadTxtAttachmentsRef.current = [];
    improveDocRef.current = false;
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
        .select('id, field_briefing_extras')
        .eq('id', thread.id)
        .single(),
    ]);
    setBriefingExtras(threadData?.field_briefing_extras || {});

    const SEARCH_IDS = new Set(['location-search', 'supplier-search']);
    const isDocThread = thread.output_type && thread.output_type !== 'recording'
      ? (DOCUMENT_OUTPUT_TYPES.has(thread.output_type) || !SEARCH_IDS.has(thread.output_type))
      : false;
    let firstUserReplaced = false;
    const enriched = (data ?? []).map(msg => {
      if (msg.role === 'assistant') return { ...msg, isDocument: (looksLikeDocument(msg.content) && DOCUMENT_OUTPUT_TYPES.has(thread.output_type)) || (thread.output_type === 'evaluation' && msg.content?.includes('```json')), streaming: false, output_type: thread.output_type };
      if (isDocThread && !firstUserReplaced && msg.role === 'user' && thread.title) {
        firstUserReplaced = true;
        return { ...msg, content: thread.title };
      }
      // Strip [Bijlage:/Transcript:] en wizard-invoerblokken (Context:/Input:) uit de bubble
      if (msg.role === 'user') {
        const stripped = msg.content
          .split('\n\n[Bijlage:')[0]
          .split('\n\n[Transcript:')[0]
          .split('\n\nContext:\n')[0]
          .split('\n\nInput:\n')[0]
          .trim();
        return { ...msg, content: stripped || msg.content };
      }
      return msg;
    });
    setMessages(enriched);
    setSendingState(false);
  }

  const handleSend = useCallback(
    async (messageText, outputType = null, taskLabel = null, displayText = null, client = null, imageAttachments = [], transcriptAttachments = [], clientConfirmed = false, wizardProject = null, textAttachments = [], pdfAttachments = [], analysisConfirmed = false, hasUserContent = true) => {
      if (sendingRef.current) return;

      // Analyse-bevestigingsflow: gebruiker reageert op "Zal ik de briefing maken?"
      if (pendingDocGenRef.current) {
        const pending = pendingDocGenRef.current;
        pendingDocGenRef.current = null;
        const userResponse = messageText.trim().toLowerCase();
        const isConfirm = /^(ja|yes|jep|yep|ok|okay|maak|genereer|doe|goed|prima|ga\s*je\s*gang|graag|zeker|doen|uitvoeren)/.test(userResponse);
        setMessages(prev => [...prev, {
          id: 'user-' + Date.now(), role: 'user', content: messageText,
          created_at: new Date().toISOString(), attachments: [],
        }]);
        if (isConfirm) {
          // Herstart met analysisConfirmed=true — slaat analyse over en genereert direct
          // threadTxtAttachmentsRef.current NIET overschrijven — handleTaskGenerate heeft de ref al correct gevuld.
          // Fallback: als pending.textAttachments leeg is (bijv. via een pad dat [] doorgaf), leid het af
          // van pending.txtAttachments zodat de txt-pill ook in de generatiebubble zichtbaar blijft.
          const pendingTextAtts = pending.textAttachments?.length > 0
            ? pending.textAttachments
            : (pending.txtAttachments ?? []).map(a => ({ filename: a.filename }));
          // Herstel het verbeter-signaal zodat de re-aanroep improveDocument=true meestuurt
          if (pending.isImprove) improveDocRef.current = true;
          handleSend(pending.messageText, pending.outputType, pending.taskLabel, pending.displayText,
            pending.client, pending.imageAttachments, [], false, pending.wizardProject, pendingTextAtts, pending.pdfAttachments,
            true /* analysisConfirmed */);
        } else {
          // Gebruiker wil iets aanvullen — gewone beurt, PDF's blijven in threadDocsRef
          setSendingState(false);
        }
        return;
      }

      // Afbeelding keuze-flow: gebruiker reageert op "informatie uithalen / bijlage"
      if (pendingImageRef.current) {
        const pending = pendingImageRef.current;
        pendingImageRef.current = null;
        const choice = messageText.trim().toLowerCase();
        if (/bijlage|toevoeg|bijvoeg/.test(choice)) {
          const lastDocMsg = messagesRef.current.slice().reverse().find(m => m.isDocument);
          if (lastDocMsg) {
            const newPhotos = pending.imageAttachments.map(a => ({
              url: `data:${a.mediaType};base64,${a.data}`,
              name: a.filename,
            }));
            setBriefingExtras(prev => ({
              ...prev,
              [lastDocMsg.id]: {
                photos: [...(prev[lastDocMsg.id]?.photos ?? []), ...newPhotos],
                links: prev[lastDocMsg.id]?.links ?? [],
              },
            }));
          }
          setMessages(prev => [
            ...prev,
            { id: 'user-img-' + Date.now(), role: 'user', content: messageText, created_at: new Date().toISOString() },
            {
              id: 'img-bijlage-' + Date.now(),
              role: 'assistant',
              content: lastDocMsg
                ? 'Afbeelding toegevoegd als bijlage aan je briefing.'
                : 'Er is nog geen document in dit gesprek om de afbeelding aan te koppelen.',
              streaming: false,
              local: true,
              created_at: new Date().toISOString(),
            },
          ]);
          return;
        }
        // "informatie" of andere keuze — stuur afbeelding door naar Claude
        imageAttachments = pending.imageAttachments;
      }

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
        pdfAttachments = pending.pdfAttachments ?? [];
        clientConfirmed = true;
        isConfirmationResponse = true;
      }
      const userMsgId = 'user-' + Date.now();
      const isPastedTranscript = !displayText && !taskLabel && textAttachments.length === 0 && transcriptAttachments.length === 0 && pdfAttachments.length === 0 && looksLikePastedTranscript(messageText);
      // Strip bestandsinhoud en wizard-invoerblokken uit het zichtbare bericht
      const visibleContent = displayText || taskLabel || messageText
        .split('\n\n[Bijlage:')[0]
        .split('\n\n[Transcript:')[0]
        .split('\n\nContext:\n')[0]
        .split('\n\nInput:\n')[0]
        .trim();
      // Bij verbetermodus: lange aanvullende tekst vervangen door korte neutrale aanduiding
      const isImproveBeforeSend = improveDocRef.current;
      const userMsg = {
        id: userMsgId,
        role: 'user',
        content: isImproveBeforeSend ? 'Aanvullende informatie ontvangen.' : visibleContent,
        created_at: new Date().toISOString(),
        attachments: [
          ...imageAttachments.map((a) => ({ type: 'image', filename: a.filename })),
          ...transcriptAttachments.map((a) => ({ type: 'transcript', filename: a.filename, content: a.content })),
          ...textAttachments.map((a) => ({ type: 'text', filename: a.filename })),
          ...pdfAttachments.map((a) => ({ type: 'pdf', filename: a.filename })),
        ],
        pastedTranscript: isPastedTranscript,
      };
      if (!isConfirmationResponse) {
        setMessages((prev) => [...prev, userMsg]);
      }
      setSendingState(true);

      // Fix 4C: veldbriefing foto-interceptor
      const currentOutputType = outputType ?? activeThreadRef.current?.output_type ?? null;
      if (currentOutputType === 'field-briefing' && !analysisConfirmed && /foto|fotos|foto's|afbeelding|afbeeldingen|upload|toevoeg|bijvoeg/i.test(messageText)) {
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

      // Chatflow allday-gespreksverslag interceptor: vraag fase vóór generatie
      const hasAlldayGesprek = (tenant?.tenant_config?.features?.output_types ?? []).includes('allday-gespreksverslag');
      const currentThreadOutputType = outputType ?? activeThreadRef.current?.output_type ?? null;
      const isAlldayChatflow = hasAlldayGesprek && !taskLabel && !outputType &&
        (currentThreadOutputType === 'allday-gespreksverslag' || /gespreksverslag/i.test(messageText)) &&
        !/Projectfase:/i.test(messageText);
      if (!isConfirmationResponse && isAlldayChatflow && !chatflowPhaseState) {
        setChatflowPhaseState({ messageText, client, imageAttachments, transcriptAttachments, textAttachments, pdfAttachments, wizardProject, clientConfirmed });
        setSendingState(false);
        return;
      }

      // Afbeelding upload interceptor — vraag keuze vóór API-call (niet in wizard-flow)
      if (!isConfirmationResponse && imageAttachments.length > 0 && !taskLabel && !displayText) {
        pendingImageRef.current = { imageAttachments };
        setMessages(prev => [...prev, {
          id: 'img-choice-' + Date.now(),
          role: 'assistant',
          content: 'Ik zie een afbeelding. Wil je dat ik er informatie uit haal, of voeg ik hem toe als bijlage aan je document?',
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
      const isGenerateIntent = !!outputType || /\b(maak|genereer)\b.{0,60}\b(briefing|document|samenvatting|evaluatie|rapport)\b|\b(maak\s+(de|hem|het|dit|haar))\b|\bdoe\s+het\s*(maar)?\b|\bbrief\w*\s+voor\s+\S/i.test(visibleContent);
      const placeholderIsDoc = isGenerateIntent && effectiveType
        ? (DOCUMENT_OUTPUT_TYPES.has(effectiveType) || !SEARCH_IDS_PLACEHOLDER.has(effectiveType))
        : false;
      const bufferedStream = textAttachments.length > 0 || transcriptAttachments.length > 0 || pdfAttachments.length > 0;
      // Recording-splitsing: generatie vanuit een recording-thread maakt een nieuw document-thread aan
      const isRecordingSplit = activeThreadRef.current?.output_type === 'recording' && isGenerateIntent;
      setMessages((prev) => {
        const placeholder = { id: placeholderId, role: 'assistant', streaming: true, streamContent: '', isDocument: placeholderIsDoc, content: '', bufferedStream };
        // Pre-gen bericht alleen als er geen PDF-bijlagen zijn — anders stuurt de server een analyse-bericht
        if (isGenerateIntent && effectivePdfAttachments.length === 0) {
          return [...prev, {
            id: 'pre-gen-' + Date.now(),
            role: 'assistant',
            content: 'Goed, ik ga er nu mee aan de slag.',
            streaming: false,
            local: true,
            created_at: new Date().toISOString(),
          }, placeholder];
        }
        return [...prev, placeholder];
      });

      const controller = new AbortController();
      abortRef.current = controller;

      // PDF-bijlagen bewaren over meerdere beurten — zodat Claude in turn 2+ nog de originele PDF leest
      if (pdfAttachments.length > 0) threadDocsRef.current = pdfAttachments;
      const effectivePdfAttachments = threadDocsRef.current;

      // Transcript-bijlagen (audio-upload via ChatInput) vullen threadTxtAttachmentsRef zodat de server
      // ze ontvangt als txtAttachments — parallel aan de PDF-ref hierboven.
      // content → data: server verwacht {filename, data}, ChatInput levert {filename, content}.
      if (transcriptAttachments.length > 0) {
        threadTxtAttachmentsRef.current = transcriptAttachments.map(a => ({ filename: a.filename, data: a.content }));
      }

      // Txt-bijlageinhoud bewaren naast PDF-binaries — [Bijlage:/Transcript:] blokken uit de berichttekst
      const txtPortion = messageText.match(/(\n\n\[(?:Bijlage|Transcript):[\s\S]+)/)?.[1] ?? '';
      if (txtPortion) threadTxtContextRef.current = txtPortion;

      recordingSplitRef.current = isRecordingSplit;

      try {
        const isImprove = improveDocRef.current;
        improveDocRef.current = false;

        const res = await fetch('/api/chat-custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId: isRecordingSplit ? null : (activeThreadRef.current?.id ?? null),
            message: messageText,
            outputType: isRecordingSplit ? null : (outputType ?? activeThreadRef.current?.output_type ?? null),
            taskLabel,
            client,
            clientConfirmed,
            imageAttachments,
            documentAttachments: effectivePdfAttachments,
            txtAttachments: threadTxtAttachmentsRef.current,
            prevHasDoc,
            project: wizardProject ?? null,
            analysisConfirmed,
            hasUserContent,
            ...(isImprove ? { improveDocument: true } : {}),
            ...(isRecordingSplit ? {
              recordingClient: activeThreadRef.current?.client ?? null,
              recordingTranscript: messagesRef.current.find(m => m.role === 'user')?.content ?? null,
            } : {}),
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
        let receivedSources = null;
        chunkBufferRef.current = '';
        streamingPlaceholderIdRef.current = placeholderId;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Stream gesloten zonder done-event (bijv. na analyse) — zorg dat UI niet blijft hangen
            setSendingState(false);
            break;
          }

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

            if (event.type === 'analysis') {
              const analysisMsg = {
                id: 'analysis-' + Date.now(),
                role: 'assistant',
                content: event.bronnenZin ? `${event.bronnenZin}\n\n${event.content}` : event.content,
                streaming: false,
                local: true,
                created_at: new Date().toISOString(),
              };
              if (event.needsConfirmation) {
                // Server stopt na analyse — sla context op zodat volgende beurt kan genereren
                // outputType: gebruik ook de via meta-event ontvangen effectiveOutputType als fallback
                // Extraheer txt-bijlagen als [{filename, data}] voor directe doorsturing naar server
                const txtAtts = [];
                const txtRe = /\n\n\[(?:Bijlage|Transcript): ([^\]]+)\]\n([\s\S]+?)(?=\n\n\[(?:Bijlage|Transcript):|$)/g;
                let txtM;
                while ((txtM = txtRe.exec(messageText)) !== null) {
                  txtAtts.push({ filename: txtM[1], data: txtM[2] });
                }
                pendingDocGenRef.current = {
                  messageText, outputType: outputType ?? activeThreadRef.current?.output_type ?? null, taskLabel, displayText, client,
                  imageAttachments, pdfAttachments: effectivePdfAttachments,
                  textAttachments,
                  txtAttachments: txtAtts,
                  txtContext: threadTxtContextRef.current,
                  wizardProject,
                  isImprove,
                };
                // Verwijder de streaming placeholder en toon alleen het analyse-bericht
                setMessages(prev => [...prev.filter(m => m.id !== placeholderId), analysisMsg]);
                setSendingState(false);
              } else {
                setMessages(prev => {
                  const idx = prev.findIndex(m => m.id === placeholderId);
                  if (idx === -1) return [...prev, analysisMsg];
                  return [...prev.slice(0, idx), analysisMsg, ...prev.slice(idx)];
                });
              }
            } else if (event.type === 'meta') {
              isDocument = event.isDocument ?? false;
              const metaOutputType = event.outputType ?? null;

              setMessages((prev) =>
                prev.map(m => m.id === placeholderId
                  ? { ...m, isDocument, ...(isDocument ? { bufferedStream: true } : {}), ...(metaOutputType ? { output_type: metaOutputType } : {}) }
                  : m)
              );

              if (!activeThreadRef.current || recordingSplitRef.current) {
                recordingSplitRef.current = false;
                const newThread = {
                  id: event.threadId,
                  title: displayText || taskLabel || messageText.slice(0, 60),
                  output_type: outputType ?? metaOutputType,
                  client: client ?? activeThreadRef.current?.client ?? null,
                  project: activeThreadRef.current?.project ?? null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                setActiveThreadBoth(newThread);
                setThreads((prev) => [newThread, ...prev]);
              } else if (metaOutputType && !activeThreadRef.current.output_type) {
                const updated = { ...activeThreadRef.current, output_type: metaOutputType };
                activeThreadRef.current = updated;
                setActiveThread(updated);
                setThreads((prev) => prev.map(t => t.id === updated.id ? { ...t, output_type: metaOutputType } : t));
              }
            } else if (event.type === 'sources') {
              receivedSources = event.sources ?? null;
              setMessages((prev) =>
                prev.map(m => m.id === placeholderId ? { ...m, sources: receivedSources } : m)
              );
            } else if (event.type === 'chunk') {
              chunkBufferRef.current += event.text;
            } else if (event.type === 'done') {
              // Flush resterende buffer voor de finale state-wissel
              streamingPlaceholderIdRef.current = null;
              if (chunkBufferRef.current) {
                const remaining = chunkBufferRef.current;
                chunkBufferRef.current = '';
                setMessages((prev) =>
                  prev.map(m =>
                    m.id === placeholderId ? { ...m, streamContent: (m.streamContent || '') + remaining } : m
                  )
                );
              }
              const finalIsDocument = isDocument;
              const finalMsg = {
                id: event.messageId,
                role: 'assistant',
                content: event.content,
                streaming: false,
                isDocument: finalIsDocument,
                bufferedStream: bufferedStream || finalIsDocument,
                output_type: outputType ?? event.outputType ?? activeThreadRef.current?.output_type ?? null,
                created_at: new Date().toISOString(),
                sources: receivedSources,
              };
              const saveClient = event.detectedClient ?? client ?? activeThreadRef.current?.client ?? null;
              const saveProject = event.detectedProject ?? activeThreadRef.current?.project ?? null;
              const effectiveDocType = outputType ?? event.outputType ?? activeThreadRef.current?.output_type ?? null;
              const DOC_NOUN = {
                'meeting-summary':     'samenvatting',
                'project-briefing':    'projectbriefing',
                'account-pm-briefing': 'briefing',
                'evaluation':          'evaluatie',
                'account-to-pm':       'briefing',
                'account-to-creation': 'briefing naar creatie',
                'field-briefing':      'ambassadorsbriefing',
                'external-debrief':    'evaluatie',
              };
              const docNoun = DOC_NOUN[effectiveDocType] ?? 'document';
              // Post-verbeter bericht buiten de updater berekenen zodat de fetch geen side-effect in de updater is
              const improvePostContent = finalIsDocument && isImprove
                ? (saveClient
                    ? `De briefing is bijgewerkt en opgeslagen in de ${saveClient}-map. Wil je nog iets aanvullen of aanpassen? Gebruik dan de Aanvullen-knop bovenaan het document.`
                    : `De briefing is bijgewerkt en opgeslagen in je klantmappen. Wil je nog iets aanvullen of aanpassen? Gebruik dan de Aanvullen-knop bovenaan het document.`)
                : null;
              setMessages((prev) => {
                // Bij verbetering: oud documentbericht verwijderen zodat er geen duplicaat ontstaat
                // (finalMsg krijgt het originele messageId, placeholder neemt die positie over)
                const base = event.improved ? prev.filter(m => m.id !== event.messageId) : prev;
                const updated = base.map(m => m.id === placeholderId ? finalMsg : m);
                if (!finalIsDocument) return updated;
                if (isImprove) {
                  // Post-verbeter begeleidend bericht — inhoud buiten updater berekend (zie hieronder)
                  return [...updated, {
                    id: 'post-doc-' + Date.now(),
                    role: 'assistant',
                    content: improvePostContent,
                    streaming: false,
                    local: true,
                    created_at: new Date().toISOString(),
                  }];
                }
                if (!isGenerateIntent) return updated;
                const postContent = effectiveDocType === 'evaluation'
                  ? `Hierboven vind je de evaluatie. Download het direct als PowerPoint en pas aan. Of bekijk en deel de evaluatie gelijk. Kan ik je nog ergens mee helpen?`
                  : saveClient
                    ? `Hier is je ${docNoun}. Via 'Aanvullen' zie je waar nog informatie ontbreekt — zo maak je hem compleet voordat je hem verstuurt. Ik heb hem opgeslagen in de map ${saveClient}. Kan ik je nog ergens mee helpen?`
                    : `Hier is je ${docNoun}. Via 'Aanvullen' zie je waar nog informatie ontbreekt — zo maak je hem compleet voordat je hem verstuurt. Ik heb hem opgeslagen. Kan ik je nog ergens mee helpen?`;
                return [...updated, {
                  id: 'post-doc-' + Date.now(),
                  role: 'assistant',
                  content: postContent,
                  streaming: false,
                  local: true,
                  created_at: new Date().toISOString(),
                }];
              });
              // Proactieve volgende stap na allday gespreksverslag
              if (finalIsDocument && isGenerateIntent && effectiveDocType === 'allday-gespreksverslag' && event.content) {
                const pm = event.content.match(/Fase (\d+) van 10/);
                const phaseNum = pm ? parseInt(pm[1]) : null;
                if (phaseNum && ALLDAY_NEXT_STEPS[phaseNum]) {
                  setAlldayNextStep({ phase: phaseNum, client: saveClient, project: saveProject });
                }
              }
              // Post-verbeter bericht opslaan in DB zodat het na herladen zichtbaar blijft
              if (improvePostContent && activeThreadRef.current?.id) {
                fetch('/api/messages', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ threadId: activeThreadRef.current.id, content: improvePostContent }),
                }).catch(() => {});
              }
              // Auto-save in background voor Aanvullen-overwrite
              if (finalIsDocument && isGenerateIntent && event.content) {
                const savedMsgId = event.messageId;
                fetch('/api/share-document', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    content: event.content,
                    outputType: finalMsg.output_type,
                    client: saveClient,
                    project: saveProject,
                  }),
                }).then(res => res.ok ? res.json() : null).then(data => {
                  if (!data?.token) return;
                  setDocumentTokens(prev => ({ ...prev, [savedMsgId]: data.token }));
                }).catch(() => {});
              }
              // ── Client-side Google Drive upload (fire-and-forget) ──────────
              const driveConfig = tenant?.tenant_config?.google_drive;
              if (finalIsDocument && driveConfig?.enabled && driveConfig?.folder_id && event.content) {
                const driveContent = event.content;
                const driveClient = saveClient;
                const driveOutputType = effectiveDocType;
                const driveFolderId = driveConfig.folder_id;
                const driveTypeLabel = OUTPUT_TYPE_INFO[driveOutputType]?.label ?? driveOutputType;
                const nowDrive = new Date();
                const ts = `${nowDrive.toISOString().slice(0, 10)}_${nowDrive.toISOString().slice(11, 16).replace(':', '-')}`;
                const driveFileName = [driveTypeLabel, driveClient, ts].filter(Boolean).join(' - ') + '.docx';
                const chaseLogoUrl = tenant?.logo_url ?? null;
                const clientLogoSlug = driveClient ? driveClient.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : null;
                const clientLogoUrl = clientLogoSlug && process.env.NEXT_PUBLIC_SUPABASE_URL
                  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-logos/${clientLogoSlug}.png`
                  : null;
                (async () => {
                  try {
                    const [chaseBuffer, clientBuffer] = await Promise.all([
                      chaseLogoUrl ? fetchImageAsBuffer(chaseLogoUrl) : Promise.resolve(null),
                      clientLogoUrl ? fetchLogoBuffer(clientLogoUrl) : Promise.resolve(null),
                    ]);
                    const blob = await buildWordBlob(
                      driveContent,
                      driveTypeLabel || driveOutputType || '',
                      { chaseBuffer, clientBuffer },
                      null,
                      driveOutputType,
                      driveClient,
                      saveProject,
                    );
                    if (!blob) return;
                    const fd = new FormData();
                    fd.append('file', blob, driveFileName);
                    fd.append('fileName', driveFileName);
                    fd.append('clientName', driveClient || '');
                    fd.append('outputType', driveOutputType || '');
                    fd.append('rootFolderId', driveFolderId);
                    const uploadRes = await fetch('/api/drive-upload', { method: 'POST', body: fd });
                    if (uploadRes.ok) console.log('[DRIVE] client-side upload geslaagd:', driveFileName);
                    else console.error('[DRIVE] upload mislukt — status:', uploadRes.status);
                  } catch (err) {
                    console.error('[DRIVE] client-side upload fout:', err?.message ?? err);
                  }
                })();
              }
              // detectedClient/Project/outputType buiten setMessages updater — nooit side effects in een pure updater
              const currentThreadId = activeThreadRef.current?.id;
              if (currentThreadId) {
                const hasClient = event.detectedClient !== undefined;
                const hasProject = event.detectedProject != null;
                const hasOutputType = event.outputType && !activeThreadRef.current?.output_type;
                if (hasClient || hasProject || hasOutputType) {
                  const newClient = (event.detectedClient != null)
                    ? event.detectedClient
                    : (activeThreadRef.current?.client ?? null);
                  const newProject = event.detectedProject ?? activeThreadRef.current?.project ?? null;
                  const newOutputType = event.outputType ?? activeThreadRef.current?.output_type ?? null;
                  setActiveThreadBoth({ ...activeThreadRef.current, client: newClient, project: newProject, output_type: newOutputType });
                  setThreads((prev) => prev.map((t) => t.id === currentThreadId
                    ? { ...t, client: newClient, project: newProject, output_type: newOutputType }
                    : t));
                }
              }
              // Belt-and-suspenders: zorg dat de thread altijd in de sidebar zichtbaar is
              if (currentThreadId) {
                setThreads(prev => {
                  if (prev.some(t => t.id === currentThreadId)) return prev;
                  const fallbackThread = {
                    id: currentThreadId,
                    title: activeThreadRef.current?.title ?? displayText ?? taskLabel ?? messageText.slice(0, 60),
                    output_type: event.outputType ?? outputType ?? null,
                    client: event.detectedClient ?? client ?? null,
                    project: event.detectedProject ?? null,
                    created_at: activeThreadRef.current?.created_at ?? new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  return [fallbackThread, ...prev];
                });
              }
              // Auto-titel: "[Klant] — [Type]" zodra client + outputType bekend zijn, vóór document-generatie
              if (!finalIsDocument && currentThreadId) {
                const effectiveClient = client || activeThreadRef.current?.client;
                const effectiveOutputType = outputType || activeThreadRef.current?.output_type;
                const typeLabel = effectiveOutputType ? OUTPUT_TYPE_INFO[effectiveOutputType]?.label : null;
                if (effectiveClient && typeLabel) {
                  const newTitle = `${typeLabel} — ${effectiveClient}`;
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
              // Evaluatiedata (van Collabor8-export) koppelen als extras voor de PowerPoint-flow
              if (finalIsDocument && event.evaluationData && event.messageId) {
                setBriefingExtras(prev => ({
                  ...prev,
                  [event.messageId]: { ...event.evaluationData },
                }));
              }
              // Wizard-foto's koppelen aan het gegenereerde document-bericht
              if (finalIsDocument && pendingWizardPhotosRef.current.length > 0) {
                const wizardPhotos = pendingWizardPhotosRef.current.map(a => ({
                  url: `data:${a.mediaType};base64,${a.data}`,
                  name: a.filename,
                }));
                setBriefingExtras(prev => ({
                  ...prev,
                  [event.messageId]: { ...(prev[event.messageId] ?? {}), photos: wizardPhotos, links: [] },
                }));
                pendingWizardPhotosRef.current = [];
              }
              if (finalIsDocument && activeThreadRef.current?.id && !event.improved) {
                // effectiveOT: gebruik event.outputType als fallback — outputType is null bij chat-flow
                const effectiveOT = outputType ?? event.outputType ?? activeThreadRef.current?.output_type ?? null;
                const outputTypeLabel = outputTypes.find(t => t.id === effectiveOT)?.label ?? null;
                setPendingTitleGen({
                  threadId: activeThreadRef.current.id,
                  content: event.content,
                  outputType: effectiveOT,
                  outputTypeLabel,
                  userMsgId,
                  fallbackTitle: displayText || taskLabel,
                  evaluationCampagne: effectiveOT === 'evaluation' && event.evaluationData?.campagne
                    ? [event.evaluationData.klant, event.evaluationData.campagne].filter(Boolean).join(' ')
                    : null,
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
                pdfAttachments,
              };
              setSendingState(false);
            } else if (event.type === 'error') {
              streamingPlaceholderIdRef.current = null;
              chunkBufferRef.current = '';
              setMessages((prev) => prev.filter(m => m.id !== placeholderId));
              setSendingState(false);
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('handleSend error:', err);
        }
        streamingPlaceholderIdRef.current = null;
        chunkBufferRef.current = '';
        // Remove placeholder on any error or abort
        setMessages((prev) => prev.filter(m => m.id !== placeholderId));
        setSendingState(false);
      }
    },
    [] // stable — reads activeThread and sending via refs (activeThreadRef, sendingRef)
  );

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleTaskClick(task) {
    setActiveTask(task);
  }

  function handleTaskGenerate(prompt, outputType, taskLabel, displayText, client, imageAttachments = [], wizardProject = null, pdfAttachments = [], txtAttachments = [], hasUserContent = true) {
    setActiveTask(null);
    // Sla wizard-foto's op in ref zodat handleSend ze kan toevoegen aan briefingExtras na genereren
    pendingWizardPhotosRef.current = imageAttachments;
    handleNewThread(); // sets activeThreadRef.current = null synchronously, resets threadTxtAttachmentsRef
    threadTxtAttachmentsRef.current = txtAttachments; // na handleNewThread zetten — anders overschreven
    handleSend(prompt, outputType, taskLabel, displayText, client, imageAttachments, [], true /* clientConfirmed — wizard bevestigt klantnaam al zelf */, wizardProject, txtAttachments, pdfAttachments, true /* analysisConfirmed — wizard heeft geen chat-interface voor bevestiging */, hasUserContent);
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

  // --- Getrapt verschijnen opname-thread (0 = niets, 1 = transcript, 2 = card, 3 = tekst) ---
  const [recordingRevealStep, setRecordingRevealStep] = useState(0);
  useEffect(() => {
    const isRecordingThread = !!(activeThread?.audio_url && messages.length > 0 && messages.every(m => m.role === 'user'));
    if (!isRecordingThread) { setRecordingRevealStep(0); return; }
    const t1 = setTimeout(() => setRecordingRevealStep(1), 300);
    const t2 = setTimeout(() => setRecordingRevealStep(2), 600);
    const t3 = setTimeout(() => setRecordingRevealStep(3), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.id, messages.length]);

  // --- Custom audio player state ---
  const audioRef = useRef(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  useEffect(() => {
    if (audioRef.current) audioRef.current.pause();
    setAudioPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
  }, [activeThread?.id]);
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

  async function handleRecordingComplete({ threadId, title, transcript, audioUrl, client }) {
    clearInterval(recordingProgressRef.current);
    setRecordingProgress(100);

    // Bouw thread-object direct uit callback-data zodat audiospeler en sidebar
    // meteen updaten — geen wachten op aparte Supabase-fetch
    const now = new Date().toISOString();
    const optimisticThread = {
      id: threadId,
      title,
      output_type: 'recording',
      client: client ?? null,
      project: null,
      field_briefing_extras: {},
      created_at: now,
      updated_at: now,
      audio_url: audioUrl,
    };
    setActiveThreadBoth(optimisticThread);
    setBriefingExtras({});
    setThreads(prev => prev.some(t => t.id === threadId) ? prev : [optimisticThread, ...prev]);

    // Toon transcript als user-bericht (direct uit response, niet streaming)
    setMessages([{
      id: 'recording-' + threadId,
      role: 'user',
      content: transcript,
      created_at: now,
      attachments: [],
      isRecordingTranscript: true,
    }]);

    setTimeout(() => {
      setRecordingPending(false);
      setRecordingProgress(0);
    }, 300);

    // Haal volledige thread op als fallback (client, project, etc.)
    try {
      const { createClient } = await import('@/lib/supabase-browser');
      const supabase = createClient();
      const { data: thread } = await supabase
        .from('threads')
        .select('id, title, output_type, client, project, created_at, updated_at, audio_url')
        .eq('id', threadId)
        .single();
      if (thread) {
        setActiveThreadBoth(thread);
        setBriefingExtras({});
        setThreads(prev => prev.map(t => t.id === thread.id ? thread : t));
      }
    } catch {
      // Optimistic data blijft staan
    }
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
        wizardConfig={activeTask ? { ...(WIZARD_CONFIG[activeTask.id] ?? {}), ...(activeTask._prefill ?? {}) } : null}
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
        savedToken={activeDocument.savedToken ?? null}
        messageId={activeDocument.messageId ?? null}
        onClose={handleCloseDocument}
        onImprove={handleCloseDocument}
        onContentSaved={(newContent) => {
          const msgId = activeDocument?.messageId;
          if (msgId) setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: newContent } : m));
        }}
      />
    )}
    <div className="flex h-full overflow-hidden">
      {/* Desktop linkerkolom — logo + sidebar, één border-r */}
      <div
        className="hidden lg:flex flex-col shrink-0 border-r border-white/[0.06] bg-[#111111]"
        style={{ width: sidebarWidth }}
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
      </div>

      {/* Drag handle sidebar resize — alleen desktop */}
      <div
        onMouseDown={startResize}
        className="hidden lg:block w-1.5 shrink-0 cursor-col-resize group/resize relative"
        title="Sleep om sidebar te resizen"
      >
        <div className="h-16 border-b border-white/[0.06]" />
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

        {/* Custom audio player — zichtbaar als de thread een opname heeft */}
        {!isEmptyState && activeThread?.audio_url && (
          <div className="shrink-0 px-4 md:px-8 py-3 border-b border-white/[0.06]">
            <div className="max-w-3xl mx-auto">
              <p className="text-[10px] font-semibold tracking-[0.10em] uppercase text-white/25 mb-2">Opname</p>
              <audio
                ref={audioRef}
                src={activeThread.audio_url}
                onTimeUpdate={() => setAudioCurrentTime(audioRef.current?.currentTime ?? 0)}
                onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration ?? 0)}
                onEnded={() => setAudioPlaying(false)}
              />
              <div className="flex items-center gap-3 h-10 px-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                <button
                  onClick={() => {
                    if (!audioRef.current) return;
                    if (audioPlaying) { audioRef.current.pause(); setAudioPlaying(false); }
                    else { audioRef.current.play(); setAudioPlaying(true); }
                  }}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-orange/15 hover:bg-orange/25 transition-colors"
                >
                  {audioPlaying
                    ? <Pause className="w-3.5 h-3.5 text-orange" strokeWidth={2} />
                    : <Play className="w-3.5 h-3.5 text-orange ml-0.5" strokeWidth={2} />
                  }
                </button>
                <div
                  className="flex-1 h-1 bg-white/[0.10] rounded-full cursor-pointer relative"
                  onClick={(e) => {
                    if (!audioRef.current || !audioDuration) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * audioDuration;
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-orange rounded-full"
                    style={{ width: audioDuration ? `${(audioCurrentTime / audioDuration) * 100}%` : '0%' }}
                  />
                </div>
                <span className="shrink-0 text-[11px] text-white/30 tabular-nums">
                  {formatAudioTime(audioCurrentTime)}{audioDuration ? ` / ${formatAudioTime(audioDuration)}` : ''}
                </span>
              </div>
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
                Hi {user.firstName ? user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1).toLowerCase() : ''}. Hoe kan ik je helpen?
              </h1>
              <ChatInput onSend={(text, opts) => handleSend(text, null, null, null, null, opts?.imageAttachments ?? [], opts?.transcriptAttachments ?? [], false, null, opts?.textAttachments ?? [], opts?.pdfAttachments ?? [])} disabled={sending} onStop={handleStop} prefill={chatPrefill} onTranscriptReady={handleTranscriptReady} />
              {outputTypes.length > 0 && (
                <div className="mt-6">
                  <TaskButtons outputTypes={outputTypes} onTaskClick={handleTaskClick} locationsEnabled={tenant?.tenant_config?.features?.locations === true} suppliersEnabled={tenant?.tenant_config?.features?.suppliers === true} />
                </div>
              )}
            </div>
            </div>
          ) : (
            <>
            <div style={{ opacity: (activeThread?.audio_url && messages.every(m => m.role === 'user')) ? (recordingRevealStep >= 1 ? 1 : 0) : 1, transition: 'opacity 0.4s ease' }}>
              <MessageList
                messages={messages}
                sending={sending}
                onOpenDocument={handleOpenDocument}
                briefingExtras={briefingExtras}
                tenant={tenant}
                threadClient={threads.find(t => t.id === activeThread?.id)?.client ?? activeThread?.client ?? null}
                threadProject={threads.find(t => t.id === activeThread?.id)?.project ?? activeThread?.project ?? null}
                outputTypes={outputTypes}
                threadId={activeThread?.id ?? null}
                onMessageDelete={(deletedId) => {
                  setMessages(prev => prev.filter(m => m.id !== deletedId));
                  if (activeDocument?.messageId === deletedId) setActiveDocument(null);
                }}
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
                onTranslated={(translatedContent) => {
                  setMessages(prev => [...prev, {
                    id: 'translated-' + Date.now(),
                    role: 'assistant',
                    content: translatedContent,
                    isDocument: true,
                    output_type: activeThread?.output_type ?? null,
                    created_at: new Date().toISOString(),
                    streaming: false,
                    local: true,
                  }]);
                }}
              />
            </div>
            {/* DocumentCard voor opname-transcript — onder het transcript bericht */}
            {activeThread?.audio_url && messages.length > 0 && messages.every(m => m.role === 'user') && (() => {
              const transcript = messages.find(m => m.role === 'user')?.content;
              if (!transcript) return null;
              return (
                <div className="px-4 md:px-8 pb-6" style={{ opacity: recordingRevealStep >= 2 ? 1 : 0, transition: 'opacity 0.4s ease' }}>
                  <div className="max-w-3xl mx-auto">
                    <DocumentCard
                      content={transcript}
                      onOpen={null}
                      tenant={tenant}
                      client={activeThread.client ?? null}
                      project={activeThread.project ?? null}
                      extras={null}
                      outputType="recording"
                      outputTypeLabel="Opname"
                      showOpen={false}
                      showShare={false}
                      createdAt={activeThread.created_at ?? null}
                      audioUrl={activeThread.audio_url ?? null}
                    />
                  </div>
                </div>
              );
            })()}
            {/* Na transcript van opname: bevestiging + klikbare actie */}
            {activeThread?.audio_url && messages.length > 0 && messages.every(m => m.role === 'user') && (
              <div className="px-4 md:px-8 pb-8" style={{ opacity: recordingRevealStep >= 3 ? 1 : 0, transition: 'opacity 0.5s ease' }}>
                <div className="max-w-3xl mx-auto flex justify-start items-start gap-3">
                  <img src="/icons/waybetter-icon.svg" alt="" aria-hidden="true" className="w-6 h-6 rounded-md shrink-0 mt-1 opacity-70" />
                  <div className="flex-1 text-[14px] text-white/80 leading-relaxed">
                    <p>
                      Je transcript is opgeslagen{' '}
                      {activeThread.client
                        ? <>in de map <span className="text-white font-medium">{activeThread.client}</span></>
                        : <>onder <span className="text-white font-medium">Overige</span> in de klantmappen</>
                      }. Je kunt het daar terugvinden via het menu.
                    </p>
                    {outputTypes.length > 0 && (
                      <>
                        <p className="mt-3 text-[13px] text-white/50">Wat wil je hiermee doen?</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {outputTypes.map(task => (
                            <button
                              key={task.id}
                              onClick={() => handleSend(
                                `Maak een ${task.label.toLowerCase()} van dit transcript`,
                                task.id,
                                task.label,
                                task.label,
                                activeThread.client ?? null,
                                [], [], false, null, [], [], false
                              )}
                              disabled={sending}
                              className="inline-flex items-center h-8 px-3 rounded-lg bg-white/[0.05] border border-white/[0.10] text-white/70 text-[12px] font-medium hover:bg-white/[0.09] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {task.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Chatflow: fase-picker voor allday gespreksverslag */}
            {chatflowPhaseState && (
              <div className="px-4 md:px-8 pb-6">
                <div className="max-w-3xl mx-auto">
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="text-[13px] font-semibold text-white">In welke fase zit dit project?</p>
                      <button onClick={() => setChatflowPhaseState(null)} className="text-white/20 hover:text-white/50 transition-colors shrink-0">
                        <X className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(WIZARD_CONFIG['allday-gespreksverslag']?.phaseOptions ?? []).map((phase, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const pending = chatflowPhaseState;
                            setChatflowPhaseState(null);
                            const augmented = pending.messageText + `\n\nProjectfase: ${phase}`;
                            handleSend(augmented, 'allday-gespreksverslag', null, null, pending.client, pending.imageAttachments, pending.transcriptAttachments, pending.clientConfirmed, pending.wizardProject, pending.textAttachments, pending.pdfAttachments);
                          }}
                          className="h-8 px-3 rounded-lg bg-white/[0.05] border border-white/[0.10] text-white/70 text-[12px] font-medium hover:bg-white/[0.09] hover:text-white transition-colors"
                        >
                          {phase}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Proactieve volgende stap na allday gespreksverslag */}
            {alldayNextStep && (() => {
              const step = ALLDAY_NEXT_STEPS[alldayNextStep.phase];
              if (!step) return null;
              const debriefTask = step.nextTask ? outputTypes.find(t => t.id === step.nextTask) : null;
              return (
                <div className="px-4 md:px-8 pb-6">
                  <div className="max-w-3xl mx-auto">
                    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <p className="text-[13px] font-semibold text-white">Klaar voor de volgende stap?</p>
                        <button onClick={() => setAlldayNextStep(null)} className="text-white/20 hover:text-white/50 transition-colors shrink-0">
                          <X className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </div>
                      <ul className="space-y-2 mb-4">
                        {step.checklist.map((q, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12px] text-white/55">
                            <span className="mt-0.5 w-3 h-3 shrink-0 border border-white/20 rounded-sm" />
                            {q}
                          </li>
                        ))}
                      </ul>
                      {debriefTask && (
                        <button
                          onClick={() => {
                            setActiveTask({ ...debriefTask, _prefill: { initialClient: alldayNextStep.client, initialProject: alldayNextStep.project } });
                            setAlldayNextStep(null);
                          }}
                          className="inline-flex items-center h-8 px-4 rounded-lg bg-orange/15 border border-orange/30 text-orange text-[12px] font-medium hover:bg-orange/25 transition-colors"
                        >
                          {step.nextLabel} →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            </>
          )}
        </div>

        {/* Input onderaan (alleen als er al berichten zijn en niet in laadscherm) */}
        {!isEmptyState && !recordingPending && (
          <div className="shrink-0 border-t border-white/[0.06] px-4 md:px-8 py-4">
            <div className="max-w-3xl mx-auto">
              <ChatInput onSend={(text, opts) => handleSend(text, null, null, null, null, opts?.imageAttachments ?? [], opts?.transcriptAttachments ?? [], false, null, opts?.textAttachments ?? [], opts?.pdfAttachments ?? [])} disabled={sending} onStop={handleStop} prefill={chatPrefill} onTranscriptReady={handleTranscriptReady} />
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
    </>
  );
}
