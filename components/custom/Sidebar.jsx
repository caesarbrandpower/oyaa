// components/custom/Sidebar.jsx
'use client';

import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar({ tenant, user, threads, activeThreadId, onNewThread, onSelectThread }) {
  const pathname = usePathname();
  const isDocsActive = pathname === '/app/docs';

  const initials = user.firstName
    ? user.firstName.slice(0, 2).toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

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

      {/* Zoekbalk (visueel, niet functioneel) */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 h-8 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg">
          <Search className="w-3.5 h-3.5 text-white/30 shrink-0" strokeWidth={2} />
          <span className="text-[12px] text-white/25">Zoeken...</span>
        </div>
      </div>

      {/* Recent label */}
      <div className="px-4 pb-1.5">
        <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-white/25">
          Recent
        </span>
      </div>

      {/* Threads lijst */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {threads.length === 0 ? (
          <p className="text-[12px] text-white/20 px-2 py-2">
            Nog geen gesprekken.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  onClick={() => onSelectThread(thread)}
                  className={`w-full text-left px-2 py-2 rounded-lg text-[12px] leading-snug transition-colors truncate ${
                    activeThreadId === thread.id
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80'
                  }`}
                >
                  {thread.title}
                </button>
              </li>
            ))}
          </ul>
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

      {/* User initials */}
      <div className="px-4 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-orange/20 border border-orange/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-orange">{initials}</span>
          </div>
          <span className="text-[12px] text-white/40 truncate">{user.email}</span>
        </div>
      </div>
    </div>
  );
}
