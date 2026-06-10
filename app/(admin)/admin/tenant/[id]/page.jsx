import { createServiceClient } from '@/lib/supabase-server';
import { getInternalUserIds } from '@/lib/admin-config';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import InternFilterToggle from '../../components/InternFilterToggle';

export const dynamic = 'force-dynamic';

export default async function TenantDetailPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;

  const showInternal = sp?.showInternal === '1';

  const now = new Date();
  const year = parseInt(sp?.year ?? now.getFullYear(), 10);
  const month = parseInt(sp?.month ?? now.getMonth() + 1, 10);

  const monthStart = new Date(year, month - 1, 1).toISOString();
  const monthEnd = new Date(year, month, 1).toISOString();

  const service = createServiceClient();

  const [
    { data: tenantRow },
    { data: threads },
    { data: tokenRows },
    authResult,
    internalIds,
  ] = await Promise.all([
    service.from('tenants').select('id, name, hostname, tenant_config').eq('id', id).single(),
    service.from('threads').select('id, user_id, output_type, created_at').eq('tenant_id', id),
    service
      .from('token_usage')
      .select('user_id, input_tokens, output_tokens, created_at')
      .eq('tenant_id', id)
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd),
    service.auth.admin.listUsers({ perPage: 1000 }),
    getInternalUserIds(service),
  ]);

  if (!tenantRow) {
    notFound();
  }

  const allUsers = authResult?.data?.users ?? [];
  const emailMap = Object.fromEntries(allUsers.map((u) => [u.id, u.email]));

  function getDisplayEmail(userId) {
    if (!userId) return 'Anoniem';
    return emailMap[userId] ?? `${userId.slice(0, 8)}...`;
  }

  function filterByIntern(row) {
    if (showInternal) return true;
    return !row.user_id || !internalIds.has(row.user_id);
  }

  const filteredThreads = (threads ?? []).filter(filterByIntern);
  const filteredTokens = (tokenRows ?? []).filter(filterByIntern);

  // Aggregeer per user_id
  const perUser = {};

  for (const thread of filteredThreads) {
    const key = thread.user_id ?? '__anon__';
    if (!perUser[key]) {
      perUser[key] = { threads: 0, types: {}, activeDays: new Set(), inputTokens: 0, outputTokens: 0 };
    }
    perUser[key].threads++;
    if (thread.output_type) {
      perUser[key].types[thread.output_type] = (perUser[key].types[thread.output_type] ?? 0) + 1;
    }
    if (thread.created_at) {
      perUser[key].activeDays.add(thread.created_at.slice(0, 10));
    }
  }

  for (const row of filteredTokens) {
    const key = row.user_id ?? '__anon__';
    if (!perUser[key]) {
      perUser[key] = { threads: 0, types: {}, activeDays: new Set(), inputTokens: 0, outputTokens: 0 };
    }
    perUser[key].inputTokens += row.input_tokens ?? 0;
    perUser[key].outputTokens += row.output_tokens ?? 0;
  }

  const entries = Object.entries(perUser).sort((a, b) => b[1].threads - a[1].threads);

  const totalThreads = filteredThreads.length;
  const uniqueUsers = new Set(filteredThreads.map((t) => t.user_id).filter(Boolean)).size;
  const totalInputTokens = filteredTokens.reduce((s, r) => s + (r.input_tokens ?? 0), 0);
  const totalOutputTokens = filteredTokens.reduce((s, r) => s + (r.output_tokens ?? 0), 0);
  const totalTokens = totalInputTokens + totalOutputTokens;

  const monthLabel = new Date(year, month - 1, 1).toLocaleString('nl', {
    month: 'long',
    year: 'numeric',
  });

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);

  const siParam = showInternal ? '&showInternal=1' : '';
  const prevHref = `/admin/tenant/${id}?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}${siParam}`;
  const nextHref = `/admin/tenant/${id}?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}${siParam}`;

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-4">
        <Link href={`/admin${showInternal ? '?showInternal=1' : ''}`} className="text-white/40 hover:text-white transition-colors">
          Overzicht
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-white/70">{tenantRow.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold">{tenantRow.name}</h1>
          <p className="text-white/40 text-sm mt-0.5">{tenantRow.hostname}</p>
        </div>
        <Suspense fallback={null}>
          <InternFilterToggle />
        </Suspense>
      </div>

      {/* Maandselector */}
      <div className="flex items-center gap-4 mt-5 mb-6">
        <a href={prevHref} className="text-white/40 hover:text-white text-sm transition-colors">
          vorige
        </a>
        <span className={`text-sm font-medium capitalize ${isCurrentMonth ? 'text-orange-400' : 'text-white/80'}`}>
          {monthLabel}
        </span>
        <a href={nextHref} className="text-white/40 hover:text-white text-sm transition-colors">
          volgende
        </a>
      </div>

      {/* Statkaarten */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/40 text-xs mb-1">Threads totaal</p>
          <p className="text-2xl font-semibold">{totalThreads.toLocaleString('nl')}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/40 text-xs mb-1">Unieke gebruikers</p>
          <p className="text-2xl font-semibold">{uniqueUsers}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/40 text-xs mb-1 capitalize">Tokens {monthLabel}</p>
          <p className="text-2xl font-semibold">{totalTokens.toLocaleString('nl')}</p>
        </div>
      </div>

      {/* Per gebruiker */}
      <section>
        <h2 className="text-sm font-semibold mb-4 text-white/60">Per gebruiker</h2>

        {entries.length === 0 ? (
          <p className="text-white/40 text-sm">Geen data.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {entries.map(([userId, data]) => {
              const isInternal = userId !== '__anon__' && internalIds.has(userId);
              const displayEmail = getDisplayEmail(userId === '__anon__' ? null : userId);
              const topTypes = Object.entries(data.types)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6);

              return (
                <div
                  key={userId}
                  className="bg-white/5 rounded-xl p-4 border border-white/10"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-white/90">{displayEmail}</span>
                    {isInternal && (
                      <span className="text-xs text-orange-400/70 bg-orange-500/10 rounded px-1.5 py-0.5">
                        intern
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-white/40 text-xs mb-0.5">Threads</p>
                      <p className="font-medium">{data.threads.toLocaleString('nl')}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs mb-0.5">Actieve dagen</p>
                      <p className="font-medium">{data.activeDays.size}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs mb-0.5 capitalize">Tokens {new Date(year, month - 1, 1).toLocaleString('nl', { month: 'long' })}</p>
                      <p className="font-medium">
                        {(data.inputTokens + data.outputTokens).toLocaleString('nl')}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs mb-0.5">Documenten</p>
                      {topTypes.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {topTypes.map(([type, count]) => (
                            <span
                              key={type}
                              className="text-xs bg-white/10 rounded px-1.5 py-0.5 text-white/60"
                            >
                              {type} ({count})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-white/30 text-xs">-</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
