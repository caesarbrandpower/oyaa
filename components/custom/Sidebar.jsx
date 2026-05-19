// components/custom/Sidebar.jsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Search, Folder, FolderOpen, ChevronRight, ChevronDown, ClipboardList, FileText, PenLine, BarChart2, Mic, MessageSquare, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

function getThreadIcon(thread) {
  if (thread.audio_url) return Mic;
  switch (thread.output_type) {
    case 'meeting-summary':     return ClipboardList;
    case 'project-briefing':    return FileText;
    case 'account-pm-briefing': return PenLine;
    case 'evaluation':          return BarChart2;
    default:                    return MessageSquare;
  }
}

export default function Sidebar({ tenant, user, threads, activeThreadId, onNewThread, onSelectThread, onRenameThread, onDeleteThread, projects = [] }) {
  const pathname = usePathname();
  const router = useRouter();
  const isDocsActive = pathname === '/app/docs';
  const [editingThreadId, setEditingThreadId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openProject, setOpenProject] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { threadId, x, y } | null
  const [deleteConfirmId, setDeleteConfirmId] = useState(null); // thread.id | null
  const contextMenuRef = useRef(null);

  const initials = user.firstName
    ? user.firstName.slice(0, 2).toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!accountOpen) return;
    function handleClick(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [accountOpen]);

  useEffect(() => {
    if (!contextMenu) return;
    function handleClick(e) {
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target)) return;
      setContextMenu(null);
      setDeleteConfirmId(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  function closeContextMenu() {
    setContextMenu(null);
    setDeleteConfirmId(null);
  }

  async function handleDeleteThread(threadId) {
    await fetch(`/api/threads/${threadId}`, { method: 'DELETE' });
    closeContextMenu();
    onDeleteThread?.(threadId);
  }

  async function handleSignOut() {
    const { createClient } = await import('@/lib/supabase-browser');
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo + bureau naam */}
      <div className="px-4 pt-5 pb-4 border-b border-white/[0.06]">
        {tenant?.logo_url ? (
          <img
            src={tenant.logo_url}
            alt={tenant.name}
            className="h-7 w-auto object-contain object-left"
          />
        ) : (
          <span className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.2em] uppercase text-orange">
            {tenant?.name ?? 'Waybetter'}
          </span>
        )}
      </div>

      {/* Nieuw gesprek */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onNewThread}
          className="w-full flex items-center gap-2 h-9 px-3 bg-orange text-white rounded-lg text-[13px] font-semibold hover:bg-[#e03d00] transition-colors"
        >
          <Plus className="w-4 h-4 shrink-0" strokeWidth={2.5} />
          Nieuw gesprek
        </button>
      </div>

      {/* Zoekbalk */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 h-8 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg">
          <Search className="w-3.5 h-3.5 text-white/30 shrink-0" strokeWidth={2} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoeken..."
            className="flex-1 bg-transparent text-[12px] text-white placeholder-white/25 outline-none"
          />
        </div>
      </div>

      {/* Projecten sectie */}
      {projects.length > 0 && (() => {
        // Sort projects by most recently active thread
        const sorted = [...projects].sort((a, b) => {
          const aTime = threads.filter(t => t.client === a.name).reduce((max, t) => t.updated_at > max ? t.updated_at : max, '');
          const bTime = threads.filter(t => t.client === b.name).reduce((max, t) => t.updated_at > max ? t.updated_at : max, '');
          return bTime.localeCompare(aTime);
        }).slice(0, 5);
        return (
          <div className="px-3 pb-2">
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-white/25 px-2 pb-1.5">
              Projecten
            </p>
            <ul className="space-y-0.5">
              {sorted.map((project) => {
                const isOpen = openProject === project.name;
                const projectThreads = threads.filter(t => t.client === project.name);
                return (
                  <li key={project.name}>
                    <button
                      onClick={() => setOpenProject(isOpen ? null : project.name)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-white/50 hover:bg-white/[0.04] hover:text-white/80 transition-colors"
                    >
                      {isOpen
                        ? <FolderOpen className="w-3 h-3 shrink-0 text-white/40" strokeWidth={1.75} />
                        : <Folder className="w-3 h-3 shrink-0 text-white/25" strokeWidth={1.75} />
                      }
                      <span className="flex-1 truncate text-left">{project.name}</span>
                      {isOpen
                        ? <ChevronDown className="w-3 h-3 shrink-0 text-white/25" strokeWidth={2} />
                        : <ChevronRight className="w-3 h-3 shrink-0 text-white/25" strokeWidth={2} />
                      }
                    </button>
                    {isOpen && projectThreads.length > 0 && (
                      <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-white/[0.06] pl-2">
                        {projectThreads.slice(0, 6).map((thread) => {
                          const Icon = getThreadIcon(thread);
                          return (
                            <li key={thread.id}>
                              <button
                                onClick={() => onSelectThread(thread)}
                                className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded-lg text-[11px] leading-snug transition-colors ${
                                  activeThreadId === thread.id
                                    ? 'bg-white/[0.08] text-white'
                                    : 'text-white/40 hover:bg-white/[0.04] hover:text-white/70'
                                }`}
                              >
                                <Icon className="w-3 h-3 shrink-0 opacity-50" strokeWidth={1.5} />
                                <span className="truncate">{thread.title}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
            <Link
              href="/app/docs"
              className="block px-2 py-1 mt-1 text-[11px] text-white/25 hover:text-white/50 transition-colors"
            >
              Alle projecten...
            </Link>
          </div>
        );
      })()}

      {/* Recent label */}
      <div className="px-4 pb-1.5">
        <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-white/25">
          Recent
        </span>
      </div>

      {/* Threads lijst — max 8, gefilterd */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {threads.length === 0 ? (
          <p className="text-[12px] text-white/20 px-2 py-2">
            Nog geen gesprekken.
          </p>
        ) : (
          <>
            <ul className="space-y-0.5">
              {threads.filter((t) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return t.title?.toLowerCase().includes(q) || t.client?.toLowerCase().includes(q);
              }).slice(0, 8).map((thread) => (
                <li key={thread.id}>
                  {editingThreadId === thread.id ? (
                    <input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          const newTitle = editingTitle.trim();
                          setEditingThreadId(null);
                          if (newTitle && newTitle !== thread.title) {
                            await fetch(`/api/threads/${thread.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ title: newTitle }),
                            });
                            onRenameThread?.(thread.id, newTitle);
                          }
                        }
                        if (e.key === 'Escape') setEditingThreadId(null);
                      }}
                      onBlur={async () => {
                        const newTitle = editingTitle.trim();
                        setEditingThreadId(null);
                        if (newTitle && newTitle !== thread.title) {
                          await fetch(`/api/threads/${thread.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title: newTitle }),
                          });
                          onRenameThread?.(thread.id, newTitle);
                        }
                      }}
                      autoFocus
                      className="w-full px-2 py-2 rounded-lg text-[12px] bg-white/[0.06] border border-white/[0.15] text-white outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => onSelectThread(thread)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ threadId: thread.id, x: e.clientX, y: e.clientY });
                        setDeleteConfirmId(null);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-[12px] leading-snug transition-colors flex items-center gap-2 ${
                        activeThreadId === thread.id
                          ? 'bg-white/[0.08] text-white'
                          : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80'
                      }`}
                    >
                      {(() => { const Icon = getThreadIcon(thread); return <Icon className="w-3.5 h-3.5 shrink-0 opacity-50" strokeWidth={1.5} />; })()}
                      <span className="truncate">{thread.title}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {threads.length > 8 && (
              <Link
                href="/app/docs"
                className="block px-2 py-1.5 mt-1 text-[11px] text-white/25 hover:text-white/50 transition-colors"
              >
                Toon meer...
              </Link>
            )}
          </>
        )}
      </div>

      {/* Alle documenten */}
      <div className="px-3 pb-2">
        <Link
          href="/app/docs"
          className={`block w-full text-left px-2 py-1.5 text-[12px] rounded-lg transition-colors ${
            isDocsActive
              ? 'bg-white/[0.08] text-white'
              : 'text-white/35 hover:text-white/70 hover:bg-white/[0.04]'
          }`}
        >
          Alle documenten
        </Link>
      </div>

      {/* Rechtermuisklik contextmenu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ position: 'fixed', top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 192) }}
          className="z-[300] w-44 bg-[#1a1a1a] border border-white/[0.10] rounded-xl shadow-2xl py-1 text-[12px]"
        >
          {deleteConfirmId === contextMenu.threadId ? (
            <div className="px-3 py-2">
              <p className="text-[11px] text-white/50 leading-snug mb-2.5">Weet je het zeker? Dit verwijdert ook alle berichten en documenten in dit gesprek.</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] text-white/50 bg-white/[0.06] hover:bg-white/[0.09] transition-colors"
                >
                  Annuleren
                </button>
                <button
                  onClick={() => handleDeleteThread(contextMenu.threadId)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] text-red-400 bg-red-950/40 hover:bg-red-950/60 transition-colors"
                >
                  Verwijderen
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  const t = threads.find(t => t.id === contextMenu.threadId);
                  if (t) { setEditingTitle(t.title || ''); setEditingThreadId(t.id); }
                  closeContextMenu();
                }}
                className="w-full text-left px-3 py-2 text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                Hernoemen
              </button>
              <div className="border-t border-white/[0.06] my-0.5" />
              <button
                onClick={() => setDeleteConfirmId(contextMenu.threadId)}
                className="w-full text-left px-3 py-2 text-red-400/80 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
              >
                Verwijderen
              </button>
            </>
          )}
        </div>
      )}

      {/* Account */}
      <div className="px-3 py-3 border-t border-white/[0.06] relative" ref={accountRef}>
        {accountOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-[#1a1a1a] border border-white/[0.10] rounded-xl shadow-2xl p-3 z-50">
            <p className="text-[13px] font-semibold text-white truncate">{user.firstName}</p>
            <p className="text-[11px] text-white/40 truncate mt-0.5">{user.email}</p>
            {tenant?.name && (
              <p className="text-[11px] text-white/25 truncate mt-0.5">{tenant.name}</p>
            )}
            <div className="border-t border-white/[0.06] mt-2.5 pt-2">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 text-[12px] text-red-400/80 hover:text-red-400 transition-colors py-0.5"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                Uitloggen
              </button>
            </div>
          </div>
        )}
        <button
          onClick={() => setAccountOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 hover:bg-white/[0.04] rounded-lg px-1 py-1 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-orange/20 border border-orange/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-orange">{initials}</span>
          </div>
          <span className="text-[12px] text-white/40 truncate">{user.email}</span>
        </button>
      </div>
    </div>
  );
}
