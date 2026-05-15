// components/custom/DocsPage.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, ClipboardList, PenLine, BarChart2, Search, ChevronRight, Menu
} from 'lucide-react';
import Sidebar from './Sidebar';
import DocumentView from './DocumentView';
import { OUTPUT_TYPE_INFO } from '@/lib/custom-prompts';

const ICON_COMPONENTS = {
  'clipboard-list': ClipboardList,
  'file-text':      FileText,
  'pen-line':       PenLine,
  'bar-chart-2':    BarChart2,
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getWeekGroup(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  // Start van huidige week (maandag)
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  // Start van vorige week
  const lastMonday = new Date(monday);
  lastMonday.setDate(monday.getDate() - 7);

  if (date >= monday) return 'Deze week';
  if (date >= lastMonday) return 'Vorige week';
  return 'Eerder';
}

function groupThreadsByWeek(threads) {
  const groups = { 'Deze week': [], 'Vorige week': [], 'Eerder': [] };
  for (const thread of threads) {
    const group = getWeekGroup(thread.updated_at || thread.created_at);
    groups[group].push(thread);
  }
  return groups;
}

export default function DocsPage({ user, tenant, docThreads, sidebarThreads }) {
  const router = useRouter();
  const [activeDocument, setActiveDocument] = useState(null);
  const [loadingThreadId, setLoadingThreadId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleOpenDoc(thread) {
    setLoadingThreadId(thread.id);
    try {
      const { createClient } = await import('@/lib/supabase-browser');
      const supabase = createClient();
      const { data } = await supabase
        .from('messages')
        .select('content')
        .eq('thread_id', thread.id)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data?.[0]?.content) {
        setActiveDocument({
          content: data[0].content,
          outputType: thread.output_type,
        });
      }
    } finally {
      setLoadingThreadId(null);
    }
  }

  const groups = groupThreadsByWeek(docThreads);
  const groupOrder = ['Deze week', 'Vorige week', 'Eerder'];
  const totalCount = docThreads.length;

  return (
    <div className="flex h-full overflow-hidden">
      {/* DocumentView overlay */}
      {activeDocument && (
        <DocumentView
          content={activeDocument.content}
          onClose={() => setActiveDocument(null)}
          onImprove={() => setActiveDocument(null)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[200px] bg-[#111111] border-r border-white/[0.06] transition-transform duration-200 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          tenant={tenant}
          user={user}
          threads={sidebarThreads}
          activeThreadId={null}
          onNewThread={() => router.push('/app')}
          onSelectThread={() => router.push('/app')}
        />
      </aside>

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

        {/* Header */}
        <header className="shrink-0 px-4 md:px-8 py-6 border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-[family-name:var(--font-lexend)] text-[22px] font-bold text-white mb-4">
              Documenten
              <span className="ml-3 text-[14px] font-normal text-white/30">
                {totalCount} document{totalCount !== 1 ? 'en' : ''}
              </span>
            </h1>
            {/* Zoekbalk + filters — visueel, niet functioneel */}
            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1 h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg">
                <Search className="w-3.5 h-3.5 text-white/30 shrink-0" strokeWidth={2} />
                <span className="text-[13px] text-white/25">Zoeken in documenten...</span>
              </div>
              <select
                disabled
                className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[12px] text-white/30 cursor-not-allowed"
              >
                <option>Type</option>
              </select>
              <select
                disabled
                className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[12px] text-white/30 cursor-not-allowed"
              >
                <option>Project</option>
              </select>
            </div>
          </div>
        </header>

        {/* Document lijst */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="max-w-3xl mx-auto">
            {totalCount === 0 ? (
              <div className="text-center py-20">
                <p className="text-[14px] text-white/30">
                  Nog geen documenten. Maak een document aan via de chat.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {groupOrder.map((groupName) => {
                  const items = groups[groupName];
                  if (items.length === 0) return null;
                  return (
                    <div key={groupName}>
                      <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-white/30 mb-3">
                        {groupName}
                      </p>
                      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                        {items.map((thread, idx) => {
                          const typeInfo = OUTPUT_TYPE_INFO[thread.output_type] ?? { label: 'Document', icon: 'file-text' };
                          const Icon = ICON_COMPONENTS[typeInfo.icon] ?? FileText;
                          const isLoading = loadingThreadId === thread.id;
                          return (
                            <button
                              key={thread.id}
                              onClick={() => handleOpenDoc(thread)}
                              disabled={isLoading}
                              className={`w-full flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.04] transition-colors text-left ${
                                idx > 0 ? 'border-t border-white/[0.05]' : ''
                              } disabled:opacity-50`}
                            >
                              <div className="shrink-0 w-8 h-8 rounded-lg bg-orange/10 border border-orange/20 flex items-center justify-center">
                                <Icon className="w-4 h-4 text-orange" strokeWidth={1.5} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-white/85 truncate">
                                  {thread.title}
                                </p>
                                <p className="text-[11px] text-white/35 mt-0.5">
                                  {typeInfo.label}
                                </p>
                              </div>
                              <div className="shrink-0 flex items-center gap-3">
                                <span className="text-[11px] text-white/30">
                                  {formatDate(thread.updated_at || thread.created_at)}
                                </span>
                                <span className="inline-flex items-center h-5 px-2 rounded-full bg-white/[0.06] text-[10px] font-semibold text-white/40">
                                  Klaar
                                </span>
                                {isLoading ? (
                                  <div className="w-4 h-4 border-2 border-white/20 border-t-orange rounded-full animate-spin" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-white/20" strokeWidth={2} />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
