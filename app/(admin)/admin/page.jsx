import { createServiceClient } from '@/lib/supabase-server';
import { getInternalUserIds } from '@/lib/admin-config';
import Link from 'next/link';
import { Suspense } from 'react';
import InternFilterToggle from './components/InternFilterToggle';
import ActivityChart from './components/ActivityChart';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage({ searchParams }) {
  const params = await searchParams;
  const showInternal = params?.showInternal === '1';

  const service = createServiceClient();

  const [{ data: tenants }, { data: threads }, { data: recentThreads }, internalIds] =
    await Promise.all([
      service.from('tenants').select('id, name, hostname').order('name'),
      service
        .from('threads')
        .select('tenant_id, output_type, user_id')
        .not('tenant_id', 'is', null),
      service
        .from('threads')
        .select('tenant_id, user_id, created_at')
        .not('tenant_id', 'is', null)
        .gte(
          'created_at',
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        ),
      getInternalUserIds(service),
    ]);

  function filterByIntern(thread) {
    if (showInternal) return true;
    return !thread.user_id || !internalIds.has(thread.user_id);
  }

  const filteredThreads = (threads ?? []).filter(filterByIntern);
  const filteredRecent = (recentThreads ?? []).filter(filterByIntern);

  const stats = {};
  for (const thread of filteredThreads) {
    const tid = thread.tenant_id;
    if (!stats[tid]) stats[tid] = { total: 0, users: new Set(), types: {} };
    stats[tid].total++;
    if (thread.user_id) stats[tid].users.add(thread.user_id);
    if (thread.output_type) {
      stats[tid].types[thread.output_type] =
        (stats[tid].types[thread.output_type] ?? 0) + 1;
    }
  }

  const activeUsers = {};
  for (const t of filteredRecent) {
    if (!activeUsers[t.tenant_id]) activeUsers[t.tenant_id] = new Set();
    if (t.user_id) activeUsers[t.tenant_id].add(t.user_id);
  }

  // Activiteitsdata voor grafiek
  const now = new Date();
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });

  const threadsByDay = {};
  for (const t of filteredRecent) {
    const day = t.created_at?.slice(0, 10);
    if (day) threadsByDay[day] = (threadsByDay[day] ?? 0) + 1;
  }

  const activityData = days.map((d) => ({
    date: d.slice(5), // MM-DD
    threads: threadsByDay[d] ?? 0,
  }));

  const totalActive = Object.values(activeUsers).reduce(
    (sum, s) => sum + s.size,
    0
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Overzicht</h1>
        <Suspense fallback={null}>
          <InternFilterToggle />
        </Suspense>
      </div>

      {/* Toplevel statistieken */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/40 text-xs mb-1">Tenants</p>
          <p className="text-2xl font-semibold">{tenants?.length ?? 0}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/40 text-xs mb-1">Threads totaal</p>
          <p className="text-2xl font-semibold">
            {filteredThreads.length.toLocaleString('nl')}
          </p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/40 text-xs mb-1">Actieve gebruikers (30d)</p>
          <p className="text-2xl font-semibold">{totalActive}</p>
        </div>
      </div>

      {/* Activiteitsgrafiek */}
      <section className="mb-8 bg-white/5 rounded-xl p-5 border border-white/10">
        <h2 className="text-sm font-semibold mb-4 text-white/60">
          Activiteit laatste 30 dagen
        </h2>
        <ActivityChart data={activityData} />
      </section>

      {/* Tenant kaarten */}
      <section>
        <h2 className="text-sm font-semibold mb-4 text-white/60">Tenants</h2>
        <div className="grid grid-cols-1 gap-3">
          {(tenants ?? []).map((t) => {
            const s = stats[t.id];
            const active = activeUsers[t.id]?.size ?? 0;
            const topTypes = s
              ? Object.entries(s.types)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
              : [];
            return (
              <Link
                key={t.id}
                href={`/admin/tenant/${t.id}`}
                className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-orange-500/40 hover:bg-white/[0.07] transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold group-hover:text-orange-400 transition-colors">
                      {t.name}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">{t.hostname}</p>
                  </div>
                  <span className="text-white/30 text-xs mt-1">Details &rarr;</span>
                </div>
                <div className="flex gap-6 mt-3 text-sm">
                  <div>
                    <p className="text-white/40 text-xs">Threads</p>
                    <p className="font-medium">{s?.total ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Gebruikers</p>
                    <p className="font-medium">{s?.users?.size ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Actief (30d)</p>
                    <p className="font-medium">{active}</p>
                  </div>
                </div>
                {topTypes.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {topTypes.map(([type, count]) => (
                      <span
                        key={type}
                        className="text-xs bg-white/10 rounded px-2 py-0.5 text-white/60"
                      >
                        {type} ({count})
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
