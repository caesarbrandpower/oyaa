// components/custom/DocsPage.jsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, ClipboardList, PenLine, BarChart2, Search,
  ChevronRight, ChevronDown, Folder, FolderOpen, Menu,
  MoreHorizontal, X, Mic, Clipboard, Send, Paintbrush, Camera, LayoutGrid,
} from 'lucide-react';
import RecordingButton from './RecordingButton';
import Sidebar from './Sidebar';
import DocumentView from './DocumentView';
import { OUTPUT_TYPE_INFO } from '@/lib/custom-prompts';

const ICON_COMPONENTS = {
  'clipboard-list': ClipboardList,
  'file-text':      FileText,
  'pen-line':       PenLine,
  'bar-chart-2':    BarChart2,
  'clipboard':      Clipboard,
  'send':           Send,
  'paintbrush':     Paintbrush,
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function buildFolderTree(threads) {
  // Returns { clientName: { __direct: [], __projects: { projectName: [] } } }
  const tree = {};
  for (const t of threads) {
    const client = t.client || 'Overige';
    if (!tree[client]) tree[client] = { __direct: [], __projects: {} };
    // Geen submap als project leeg is of (case-insensitief) gelijk aan klantnaam
    const project = (t.project && t.project.toLowerCase().trim() !== (t.client || '').toLowerCase().trim()) ? t.project : null;
    if (project) {
      if (!tree[client].__projects[project]) tree[client].__projects[project] = [];
      tree[client].__projects[project].push(t);
    } else {
      tree[client].__direct.push(t);
    }
  }
  return tree;
}

function sortedClients(tree) {
  return Object.keys(tree).sort((a, b) => {
    if (a === 'Overige') return 1;
    if (b === 'Overige') return -1;
    return a.localeCompare(b, 'nl');
  });
}

export default function DocsPage({ user, tenant, docThreads, sidebarThreads, projects = [] }) {
  const router = useRouter();
  const [threads, setThreads] = useState(docThreads);
  const [activeDocument, setActiveDocument] = useState(null);
  // clientLogos: { [clientName]: string (publicUrl) | null }
  const [clientLogos, setClientLogos] = useState({});
  const logoInputRefs = useRef({});
  const [loadingThreadId, setLoadingThreadId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load client logos from Supabase Storage on mount
  useEffect(() => {
    const uniqueClients = [...new Set(docThreads.map(t => t.client).filter(Boolean))];
    if (uniqueClients.length === 0 || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const logos = {};
    let pending = uniqueClients.length;
    uniqueClients.forEach(name => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-logos/${slug}`;
      const pngUrl = base + '.png';
      const svgUrl = base + '.svg';
      const img = new Image();
      img.onload = () => {
        logos[name] = pngUrl;
        if (--pending === 0) setClientLogos({ ...logos });
      };
      img.onerror = () => {
        const svg = new Image();
        svg.onload = () => {
          logos[name] = svgUrl;
          if (--pending === 0) setClientLogos({ ...logos });
        };
        svg.onerror = () => {
          logos[name] = null;
          if (--pending === 0) setClientLogos({ ...logos });
        };
        svg.src = svgUrl;
      };
      img.src = pngUrl;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [openFolders, setOpenFolders] = useState(() => {
    // Alleen de map met het meest recente item standaard open
    if (docThreads.length === 0) return new Set();
    const mostRecent = docThreads[0]; // al gesorteerd nieuwste eerst
    const activeClient = mostRecent.client || 'Overige';
    return new Set([activeClient]);
  });
  // Open de juiste map als ?client=... in de URL staat
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientParam = params.get('client');
    if (!clientParam) return;
    setOpenFolders((prev) => new Set([...prev, clientParam]));
    setTimeout(() => {
      document.getElementById(`folder-${clientParam}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }, []);

  const [moveMenu, setMoveMenu] = useState(null); // threadId
  const [moveInputVisible, setMoveInputVisible] = useState(false);
  const [moveInputValue, setMoveInputValue] = useState('');
  const [renameMode, setRenameMode] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null); // threadId
  const moveMenuRef = useRef(null);
  const [inlineRenameId, setInlineRenameId] = useState(null); // threadId
  const [inlineRenameValue, setInlineRenameValue] = useState('');
  const [folderMenu, setFolderMenu] = useState(null); // clientName | null
  const [folderDeleteConfirm, setFolderDeleteConfirm] = useState(null); // clientName | null
  const folderMenuRef = useRef(null);

  // Sluit move-menu bij klik buiten
  useEffect(() => {
    function handleClick(e) {
      if (moveMenu && moveMenuRef.current && !moveMenuRef.current.contains(e.target)) {
        closeMoveMenu();
      }
      if (folderMenu && folderMenuRef.current && !folderMenuRef.current.contains(e.target)) {
        setFolderMenu(null);
        setFolderDeleteConfirm(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moveMenu, folderMenu]); // eslint-disable-line react-hooks/exhaustive-deps

  function clientLogoStoragePath(name, ext = 'png') {
    // Sanitize: lowercase, non-alphanumeric → hyphen, collapse repeats
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `${slug}.${ext}`;
  }

  async function handleLogoUpload(clientName, file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientName', clientName);
    const res = await fetch('/api/upload-client-logo', { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Logo upload fout:', err.error ?? res.status);
      return;
    }
    const { url } = await res.json();
    if (url) setClientLogos(prev => ({ ...prev, [clientName]: url + `?t=${Date.now()}` }));
  }

  async function handleOpenDoc(thread) {
    setLoadingThreadId(thread.id);
    try {
      const { createClient } = await import('@/lib/supabase-browser');
      const supabase = createClient();
      const [{ data: msgs }, { data: threadData }] = await Promise.all([
        supabase
          .from('messages')
          .select('id, content')
          .eq('thread_id', thread.id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('threads')
          .select('field_briefing_extras')
          .eq('id', thread.id)
          .single(),
      ]);

      if (msgs?.[0]?.content) {
        const messageId = msgs[0].id;
        const extras = threadData?.field_briefing_extras?.[messageId] ?? null;
        setActiveDocument({ content: msgs[0].content, outputType: thread.output_type, client: thread.client ?? null, extras });
      }
    } finally {
      setLoadingThreadId(null);
    }
  }

  async function handleMove(threadId, newClient) {
    const clientValue = newClient === 'Overige' ? null : newClient;
    await fetch(`/api/threads/${threadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: clientValue, project: null }),
    });
    setThreads(prev =>
      prev.map(t => t.id === threadId ? { ...t, client: clientValue, project: null } : t)
    );
    setOpenFolders(prev => new Set([...prev, newClient]));
    setMoveMenu(null);
    setMoveInputVisible(false);
    setMoveInputValue('');
  }

  function closeMoveMenu() {
    setMoveMenu(null);
    setMoveInputVisible(false);
    setMoveInputValue('');
    setRenameMode(false);
    setRenameValue('');
    setDeleteConfirmId(null);
  }

  async function handleDeleteDoc(threadId) {
    await fetch(`/api/threads/${threadId}`, { method: 'DELETE' });
    closeMoveMenu();
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
  }

  async function handleDeleteFolder(clientName) {
    const toDelete = threads.filter(t => (t.client || 'Overige') === clientName);
    console.log('[handleDeleteFolder] start | clientName:', clientName, '| toDelete.length:', toDelete.length, '| ids:', toDelete.map(t => t.id));

    const results = [];
    for (const t of toDelete) {
      console.log('[handleDeleteFolder] deleting', t.id);
      try {
        const r = await fetch(`/api/threads/${t.id}`, { method: 'DELETE' });
        const body = await r.json().catch(() => null);
        console.log('[handleDeleteFolder]', t.id, '| status:', r.status, '| body:', body);
        results.push({ id: t.id, ok: r.ok, status: r.status, body });
      } catch (err) {
        console.error('[handleDeleteFolder] fetch error', t.id, String(err));
        results.push({ id: t.id, ok: false, error: String(err) });
      }
    }

    console.log('[handleDeleteFolder] done | results:', results);
    if (results.every(r => r.ok)) {
      setThreads((prev) => prev.filter(t => (t.client || 'Overige') !== clientName));
    }
    setFolderMenu(null);
    setFolderDeleteConfirm(null);
  }

  async function handleRename(threadId) {
    const newTitle = renameValue.trim();
    closeMoveMenu();
    if (!newTitle) return;
    await fetch(`/api/threads/${threadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, title: newTitle } : t));
  }

  function toggleFolder(name) {
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const tree = buildFolderTree(threads);
  const clients = sortedClients(tree);
  const allClientNames = clients.filter(c => c !== 'Overige');

  // Afleiden van sidebarProjects uit huidige threads state — automatisch in sync na verwijdering
  const sidebarProjects = (() => {
    const counts = {};
    for (const t of threads) {
      if (t.client) counts[t.client] = (counts[t.client] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  })();

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

  // Zoekfilter — platte lijst
  const q = searchQuery.trim().toLowerCase();
  const filteredThreads = q
    ? threads.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.client?.toLowerCase().includes(q) ||
        t.project?.toLowerCase().includes(q)
      )
    : null;

  function renderDocRow(thread, isLast) {
    const isRecording = !!thread.audio_url;
    const typeInfo = isRecording
      ? { label: 'Opname' }
      : OUTPUT_TYPE_INFO[thread.output_type] ?? { label: 'Document', icon: 'file-text' };
    const Icon = isRecording ? Mic : (ICON_COMPONENTS[typeInfo.icon] ?? FileText);
    const isLoading = !isRecording && loadingThreadId === thread.id;
    const isMenuOpen = moveMenu === thread.id;

    return (
      <div
        key={thread.id}
        className={`flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group ${
          !isLast ? 'border-b border-white/[0.05]' : ''
        }`}
      >
        {/* Icon — opent doc */}
        <button
          onClick={() => isRecording ? router.push('/app?thread=' + thread.id) : handleOpenDoc(thread)}
          disabled={isLoading}
          className="shrink-0 disabled:opacity-50"
        >
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
            isRecording
              ? 'bg-white/[0.05] border border-white/[0.10]'
              : 'bg-orange/10 border border-orange/20'
          }`}>
            <Icon className={`w-3.5 h-3.5 ${isRecording ? 'text-white/40' : 'text-orange'}`} strokeWidth={1.5} />
          </div>
        </button>

        {/* Titel — klik om inline te hernoemen */}
        <div className="flex-1 min-w-0">
          {inlineRenameId === thread.id ? (
            <div className="flex gap-1.5 items-center">
              <input
                autoFocus
                value={inlineRenameValue}
                onChange={e => setInlineRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const newTitle = inlineRenameValue.trim();
                    setInlineRenameId(null);
                    if (newTitle && newTitle !== thread.title) {
                      fetch(`/api/threads/${thread.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: newTitle }),
                      }).catch(() => {});
                      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, title: newTitle } : t));
                    }
                  }
                  if (e.key === 'Escape') setInlineRenameId(null);
                }}
                onBlur={() => setInlineRenameId(null)}
                className="flex-1 bg-white/[0.06] border border-white/[0.15] rounded-lg px-2 py-1 text-[12px] text-white placeholder-white/25 outline-none focus:border-white/[0.30] min-w-0"
              />
            </div>
          ) : (
            <button
              onClick={() => { setInlineRenameId(thread.id); setInlineRenameValue(thread.title || ''); }}
              className="w-full text-left"
              title="Klik om te hernoemen"
            >
              <p className="text-[13px] font-medium text-white/80 truncate">{thread.title}</p>
              <p className="text-[11px] text-white/30 mt-0.5">{typeInfo.label}</p>
            </button>
          )}
        </div>

        {/* Datum + chevron — opent doc */}
        <button
          onClick={() => isRecording ? router.push('/app?thread=' + thread.id) : handleOpenDoc(thread)}
          disabled={isLoading}
          className="shrink-0 flex items-center gap-2 disabled:opacity-50"
        >
          <span className="text-[11px] text-white/25">{formatDate(thread.updated_at || thread.created_at)}</span>
          {isLoading
            ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-orange rounded-full animate-spin" />
            : <ChevronRight className="w-3.5 h-3.5 text-white/15" strokeWidth={2} />
          }
        </button>

        {/* Verplaatsen — 3-puntjes */}
        <div className="relative shrink-0" ref={isMenuOpen ? moveMenuRef : null}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isMenuOpen) {
                closeMoveMenu();
              } else {
                setMoveMenu(thread.id);
                setMoveInputVisible(false);
                setMoveInputValue('');
                setRenameMode(false);
                setRenameValue('');
              }
            }}
            className="w-6 h-6 flex items-center justify-center rounded text-white/20 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={2} />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-7 z-[9999] w-48 bg-[#1a1a1a] border border-white/[0.10] rounded-xl shadow-2xl py-1 text-[12px]">
              {renameMode ? (
                <div className="px-3 py-2 flex gap-1.5">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(thread.id);
                      if (e.key === 'Escape') { setRenameMode(false); setRenameValue(''); }
                    }}
                    placeholder="Nieuwe naam..."
                    className="flex-1 bg-white/[0.06] border border-white/[0.12] rounded-lg px-2 py-1 text-[11px] text-white placeholder-white/25 outline-none focus:border-white/[0.25]"
                  />
                  <button
                    onClick={() => handleRename(thread.id)}
                    disabled={!renameValue.trim()}
                    className="px-2 py-1 bg-orange rounded-lg text-white text-[10px] font-semibold disabled:opacity-30 hover:bg-[#e03d00] transition-colors"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => { setRenameValue(thread.title || ''); setRenameMode(true); }}
                    className="w-full text-left px-3 py-2 text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    Hernoemen
                  </button>
                  <div className="border-t border-white/[0.06] my-1" />
                  <p className="px-3 py-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider">
                    Verplaatsen naar
                  </p>
                </>
              )}
              {!renameMode && !deleteConfirmId && (<>
              {allClientNames
                .filter(c => c !== (thread.client || 'Overige'))
                .map(name => (
                  <button
                    key={name}
                    onClick={() => handleMove(thread.id, name)}
                    className="w-full text-left px-3 py-2 text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                  >
                    <Folder className="w-3.5 h-3.5 shrink-0 text-white/30" strokeWidth={1.5} />
                    {name}
                  </button>
                ))
              }
              {thread.client && (
                <button
                  onClick={() => handleMove(thread.id, 'Overige')}
                  className="w-full text-left px-3 py-2 text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                >
                  <Folder className="w-3.5 h-3.5 shrink-0 text-white/30" strokeWidth={1.5} />
                  Overige
                </button>
              )}
              <div className="border-t border-white/[0.06] mt-1 pt-1">
                {moveInputVisible ? (
                  <div className="px-3 py-2 flex gap-1.5">
                    <input
                      autoFocus
                      value={moveInputValue}
                      onChange={e => setMoveInputValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && moveInputValue.trim()) handleMove(thread.id, moveInputValue.trim());
                        if (e.key === 'Escape') { setMoveInputVisible(false); setMoveInputValue(''); }
                      }}
                      placeholder="Mapnaam..."
                      className="flex-1 bg-white/[0.06] border border-white/[0.12] rounded-lg px-2 py-1 text-[11px] text-white placeholder-white/25 outline-none focus:border-white/[0.25]"
                    />
                    <button
                      onClick={() => moveInputValue.trim() && handleMove(thread.id, moveInputValue.trim())}
                      disabled={!moveInputValue.trim()}
                      className="px-2 py-1 bg-orange rounded-lg text-white text-[10px] font-semibold disabled:opacity-30 hover:bg-[#e03d00] transition-colors"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setMoveInputVisible(true)}
                    className="w-full text-left px-3 py-2 text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                  >
                    + Nieuwe map...
                  </button>
                )}
              </div>
              <div className="border-t border-white/[0.06] mt-1 pt-1">
                <button
                  onClick={() => setDeleteConfirmId(thread.id)}
                  className="w-full text-left px-3 py-2 text-red-400/70 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
                >
                  Verwijderen
                </button>
              </div>
              </>)}
              {deleteConfirmId === thread.id && (
                <div className="px-3 py-2">
                  <p className="text-[11px] text-white/50 leading-snug mb-2">Weet je het zeker? Dit verwijdert ook alle berichten en documenten in dit gesprek.</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="flex-1 py-1.5 rounded-lg text-[10px] text-white/50 bg-white/[0.06] hover:bg-white/[0.09] transition-colors"
                    >
                      Annuleren
                    </button>
                    <button
                      onClick={() => handleDeleteDoc(thread.id)}
                      className="flex-1 py-1.5 rounded-lg text-[10px] text-red-400 bg-red-950/40 hover:bg-red-950/60 transition-colors"
                    >
                      Verwijderen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {activeDocument && (
        <DocumentView
          content={activeDocument.content}
          client={activeDocument.client ?? null}
          tenant={tenant}
          onClose={() => setActiveDocument(null)}
          onImprove={(prefillText) => {
            setActiveDocument(null);
            router.push(prefillText ? '/app?prefill=' + encodeURIComponent(prefillText) : '/app');
          }}
        />
      )}

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
          threads={sidebarThreads}
          activeThreadId={null}
          onNewThread={() => router.push('/app')}
          onSelectThread={(t) => router.push('/app?thread=' + t.id)}
          projects={sidebarProjects}
        />
      </aside>

      {/* Drag handle sidebar resize — alleen desktop */}
      <div
        onMouseDown={startResize}
        className="hidden lg:block w-1.5 shrink-0 cursor-col-resize group/resize relative"
        title="Sleep om sidebar te resizen"
      >
        <div className="h-16 border-b border-white/[0.06]" />
        <div className="absolute inset-x-0 h-px bg-white/[0.06]" style={{ top: '200px' }} />
        <div className="absolute inset-y-0 left-0 w-px bg-white/[0.06] group-hover/resize:bg-orange/40 transition-colors" />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Hoofdgebied */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header — buiten zoom wrapper, zodat border aansluit op sidebar logo (beide h-16 = 64px) */}
        <header className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.06] shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/40 hover:text-white/70 transition-colors" aria-label="Menu openen">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <RecordingButton />
        </header>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ zoom: 1.1 }}>

        {/* Header */}
        <header className="shrink-0 px-4 md:px-8 py-6 border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-[family-name:var(--font-lexend)] text-[22px] font-bold text-white mb-4">
              Documenten
              <span className="ml-3 text-[14px] font-normal text-white/30">
                {threads.length} document{threads.length !== 1 ? 'en' : ''}
              </span>
            </h1>
            <div className="flex items-center gap-2 h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg">
              <Search className="w-3.5 h-3.5 text-white/30 shrink-0" strokeWidth={2} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Zoeken in documenten..."
                className="flex-1 bg-transparent text-[13px] text-white placeholder-white/25 outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-white/30 hover:text-white/60 transition-colors">
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Document lijst */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="max-w-3xl mx-auto">
            {threads.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-[14px] text-white/30">Nog geen documenten. Maak een document aan via de chat.</p>
              </div>
            ) : filteredThreads !== null ? (
              /* Zoekresultaten — platte lijst */
              <div>
                <p className="text-[11px] text-white/30 mb-3">
                  {filteredThreads.length} resultaat{filteredThreads.length !== 1 ? 'en' : ''} voor "{searchQuery}"
                </p>
                {filteredThreads.length === 0 ? (
                  <p className="text-[13px] text-white/25 italic">Geen documenten gevonden.</p>
                ) : (
                  <div className="rounded-xl border border-white/[0.08]">
                    {filteredThreads.map((t, i) => renderDocRow(t, i === filteredThreads.length - 1))}
                  </div>
                )}
              </div>
            ) : (
              /* Mappenstructuur */
              <div className="space-y-2">
                {clients.map(clientName => {
                  const folder = tree[clientName];
                  const projectNames = Object.keys(folder.__projects).sort((a, b) => a.localeCompare(b, 'nl'));
                  const totalDocs = folder.__direct.length + projectNames.reduce((s, p) => s + folder.__projects[p].length, 0);
                  const isOpen = openFolders.has(clientName);

                  return (
                    <div key={clientName} id={`folder-${clientName}`} className="rounded-xl border border-white/[0.08]">
                      {/* Client-map header */}
                      <div className="flex items-center group/folder">
                        <button
                          onClick={() => toggleFolder(clientName)}
                          className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                        >
                          {isOpen
                            ? <FolderOpen className="w-4 h-4 text-orange/70 shrink-0" strokeWidth={1.5} />
                            : <Folder className="w-4 h-4 text-white/30 shrink-0" strokeWidth={1.5} />
                          }
                          <span className="flex-1 text-[13px] font-semibold text-white/80">{clientName}</span>
                          <span className="text-[11px] text-white/25 mr-2">{totalDocs}</span>
                          {isOpen
                            ? <ChevronDown className="w-3.5 h-3.5 text-white/20" strokeWidth={2} />
                            : <ChevronRight className="w-3.5 h-3.5 text-white/20" strokeWidth={2} />
                          }
                        </button>
                        {clientName !== 'Overige' && (
                          <>
                            <input
                              ref={el => { logoInputRefs.current[clientName] = el; }}
                              type="file"
                              accept=".png,.svg,image/png,image/svg+xml"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleLogoUpload(clientName, file);
                                e.target.value = '';
                              }}
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); logoInputRefs.current[clientName]?.click(); }}
                              title="Logo uploaden — PNG of SVG, minimaal 400px breed, voor de beste kwaliteit in documenten"
                              className="opacity-0 group-hover/folder:opacity-100 w-6 h-6 flex items-center justify-center rounded text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all"
                            >
                              <Camera className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </button>
                            {/* Map 3-dots menu */}
                            <div
                              ref={folderMenu === clientName ? folderMenuRef : null}
                              className="relative mr-2"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (folderMenu === clientName) {
                                    setFolderMenu(null);
                                    setFolderDeleteConfirm(null);
                                  } else {
                                    setFolderMenu(clientName);
                                    setFolderDeleteConfirm(null);
                                  }
                                }}
                                title="Mapopties"
                                className="opacity-0 group-hover/folder:opacity-100 w-6 h-6 flex items-center justify-center rounded text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={2} />
                              </button>
                              {folderMenu === clientName && (
                                <div className="absolute right-0 top-7 z-[9999] w-52 bg-[#1a1a1a] border border-white/[0.10] rounded-xl shadow-2xl py-1 text-[12px]">
                                  {folderDeleteConfirm === clientName ? (
                                    <div className="px-3 py-2.5">
                                      <p className="text-[11px] text-white/60 leading-snug mb-2.5">
                                        Weet je zeker dat je <span className="text-white font-semibold">{clientName}</span> wilt verwijderen?
                                        {totalDocs > 0 && <> Dit verwijdert ook alle <span className="text-white font-semibold">{totalDocs} document{totalDocs !== 1 ? 'en' : ''}</span> erin.</>}
                                      </p>
                                      <div className="flex gap-1.5">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setFolderDeleteConfirm(null); }}
                                          className="flex-1 py-1.5 rounded-lg text-[10px] text-white/50 bg-white/[0.06] hover:bg-white/[0.09] transition-colors"
                                        >
                                          Annuleren
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleDeleteFolder(clientName); }}
                                          className="flex-1 py-1.5 rounded-lg text-[10px] text-red-400 bg-red-950/40 hover:bg-red-950/60 transition-colors"
                                        >
                                          Verwijderen
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setFolderDeleteConfirm(clientName); }}
                                      className="w-full text-left px-3 py-2 text-red-400/70 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
                                    >
                                      Map verwijderen
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {isOpen && (
                        <div className="border-t border-white/[0.05]">
                          {/* Directe documenten onder client (geen project) */}
                          {folder.__direct.map((t, i) => (
                            <div key={t.id} className="pl-4">
                              {renderDocRow(t, i === folder.__direct.length - 1 && projectNames.length === 0)}
                            </div>
                          ))}

                          {/* Project-submappen */}
                          {projectNames.map((projectName, pi) => {
                            const projectKey = `${clientName}/${projectName}`;
                            const projOpen = openFolders.has(projectKey);
                            const projDocs = folder.__projects[projectName];
                            const isLastProject = pi === projectNames.length - 1;

                            return (
                              <div key={projectName} className={!isLastProject || folder.__direct.length > 0 ? '' : ''}>
                                <button
                                  onClick={() => toggleFolder(projectKey)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 pl-8 hover:bg-white/[0.03] transition-colors text-left border-t border-white/[0.04]"
                                >
                                  {projOpen
                                    ? <FolderOpen className="w-3.5 h-3.5 text-white/40 shrink-0" strokeWidth={1.5} />
                                    : <Folder className="w-3.5 h-3.5 text-white/25 shrink-0" strokeWidth={1.5} />
                                  }
                                  <span className="flex-1 text-[12px] font-medium text-white/55">{projectName}</span>
                                  <span className="text-[10px] text-white/20 mr-1">{projDocs.length}</span>
                                  {projOpen
                                    ? <ChevronDown className="w-3 h-3 text-white/15" strokeWidth={2} />
                                    : <ChevronRight className="w-3 h-3 text-white/15" strokeWidth={2} />
                                  }
                                </button>

                                {projOpen && (
                                  <div className="pl-8 border-t border-white/[0.04]">
                                    {projDocs.map((t, i) => renderDocRow(t, i === projDocs.length - 1))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </div>{/* sluit zoom wrapper */}
      </div>
    </div>
  );
}
