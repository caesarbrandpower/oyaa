// app/(admin)/admin/page.jsx
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const service = createServiceClient();

  const [{ data: tenants }, { data: threads }, { data: recentThreads }] = await Promise.all([
    service.from('tenants').select('id, name, hostname').order('name'),
    service.from('threads').select('tenant_id, output_type, user_id').not('tenant_id', 'is', null),
    service
      .from('threads')
      .select('tenant_id, user_id')
      .not('tenant_id', 'is', null)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  // Aggregeer per tenant
  const stats = {};
  for (const thread of threads ?? []) {
    const tid = thread.tenant_id;
    if (!stats[tid]) stats[tid] = { total: 0, users: new Set(), types: {} };
    stats[tid].total++;
    if (thread.user_id) stats[tid].users.add(thread.user_id);
    if (thread.output_type) {
      stats[tid].types[thread.output_type] = (stats[tid].types[thread.output_type] ?? 0) + 1;
    }
  }

  const activeUsers = {};
  for (const t of recentThreads ?? []) {
    if (!activeUsers[t.tenant_id]) activeUsers[t.tenant_id] = new Set();
    if (t.user_id) activeUsers[t.tenant_id].add(t.user_id);
  }

  // Top-3 output types per tenant (voor weergave)
  function topTypes(types) {
    return Object.entries(types)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `${type} (${count})`)
      .join(', ');
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Overzicht</h1>

      <section className="mb-10">
        <h2 className="text-base font-semibold mb-3 text-white/80">Tenants</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-white/20 text-left text-white/50">
              <th className="pb-2 pr-6 font-medium">Tenant</th>
              <th className="pb-2 pr-6 font-medium">Hostname</th>
              <th className="pb-2 pr-6 font-medium">Threads</th>
              <th className="pb-2 pr-6 font-medium">Gebruikers</th>
              <th className="pb-2 pr-6 font-medium">Actief (30d)</th>
              <th className="pb-2 font-medium">Top types</th>
            </tr>
          </thead>
          <tbody>
            {(tenants ?? []).map((t) => {
              const s = stats[t.id];
              return (
                <tr key={t.id} className="border-b border-white/10 hover:bg-white/5">
                  <td className="py-3 pr-6">{t.name}</td>
                  <td className="py-3 pr-6 text-white/50 text-xs">{t.hostname}</td>
                  <td className="py-3 pr-6">{s?.total ?? 0}</td>
                  <td className="py-3 pr-6">{s?.users?.size ?? 0}</td>
                  <td className="py-3 pr-6">{activeUsers[t.id]?.size ?? 0}</td>
                  <td className="py-3 text-white/50 text-xs">{s ? topTypes(s.types) : 'geen'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-3 text-white/80">Documenten per type (alle tenants)</h2>
        <table className="w-full text-sm border-collapse max-w-lg">
          <thead>
            <tr className="border-b border-white/20 text-left text-white/50">
              <th className="pb-2 pr-6 font-medium">Output type</th>
              <th className="pb-2 font-medium">Aantal</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(
              (threads ?? []).reduce((acc, t) => {
                if (t.output_type) acc[t.output_type] = (acc[t.output_type] ?? 0) + 1;
                return acc;
              }, {})
            )
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <tr key={type} className="border-b border-white/10 hover:bg-white/5">
                  <td className="py-2 pr-6">{type}</td>
                  <td className="py-2">{count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
