// app/(admin)/admin/tokens/page.jsx
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// USD per 1 miljoen tokens — verifieer op https://www.anthropic.com/pricing
const TOKEN_COSTS = {
  'claude-sonnet-4-6':        { input: 3.00,  output: 15.00, cache_read: 0.30,  cache_creation: 3.75 },
  'claude-haiku-4-5-20251001': { input: 0.25,  output: 1.25,  cache_read: 0.03,  cache_creation: 0.30 },
};

function estimateCost(row, model) {
  const c = TOKEN_COSTS[model] ?? { input: 0, output: 0, cache_read: 0, cache_creation: 0 };
  return (
    (row.input * c.input +
      row.output * c.output +
      row.cache_read * c.cache_read +
      row.cache_creation * c.cache_creation) / 1_000_000
  );
}

export default async function AdminTokensPage({ searchParams }) {
  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params?.year ?? now.getFullYear(), 10);
  const month = parseInt(params?.month ?? now.getMonth() + 1, 10);

  const monthStart = new Date(year, month - 1, 1).toISOString();
  const monthEnd   = new Date(year, month, 1).toISOString();

  const service = createServiceClient();

  const [{ data: tenants }, { data: rows }] = await Promise.all([
    service.from('tenants').select('id, name'),
    service
      .from('token_usage')
      .select('tenant_id, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens')
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd),
  ]);

  const tenantMap = Object.fromEntries((tenants ?? []).map((t) => [t.id, t.name]));

  // Aggregeer per tenant + model
  const agg = {};
  for (const row of rows ?? []) {
    const key = `${row.tenant_id ?? 'onbekend'}___${row.model}`;
    if (!agg[key]) {
      agg[key] = { tenantId: row.tenant_id, model: row.model, input: 0, output: 0, cache_read: 0, cache_creation: 0 };
    }
    agg[key].input          += row.input_tokens;
    agg[key].output         += row.output_tokens;
    agg[key].cache_read     += row.cache_read_tokens;
    agg[key].cache_creation += row.cache_creation_tokens;
  }

  const entries = Object.values(agg).sort((a, b) => {
    const na = tenantMap[a.tenantId] ?? '';
    const nb = tenantMap[b.tenantId] ?? '';
    return na.localeCompare(nb) || a.model.localeCompare(b.model);
  });

  const totalCost = entries.reduce((sum, e) => sum + estimateCost(e, e.model), 0);

  const monthLabel = new Date(year, month - 1, 1).toLocaleString('nl', { month: 'long', year: 'numeric' });

  // Prev/next maand links
  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const prevHref = `/admin/tokens?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}`;
  const nextHref = `/admin/tokens?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}`;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Token-verbruik</h1>
        <a href={prevHref} className="text-white/40 hover:text-white text-sm">vorige</a>
        <span className="text-white/80 text-sm font-medium capitalize">{monthLabel}</span>
        <a href={nextHref} className="text-white/40 hover:text-white text-sm">volgende</a>
      </div>

      <p className="text-white/50 text-sm mb-6">
        Geschatte totale kosten: <strong className="text-white">${totalCost.toFixed(4)}</strong>
        {' '}Tarieven zijn indicatief, verifieer via Anthropic pricing.
      </p>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-white/20 text-left text-white/50">
            <th className="pb-2 pr-4 font-medium">Tenant</th>
            <th className="pb-2 pr-4 font-medium">Model</th>
            <th className="pb-2 pr-4 font-medium text-right">Input</th>
            <th className="pb-2 pr-4 font-medium text-right">Output</th>
            <th className="pb-2 pr-4 font-medium text-right">Cache read</th>
            <th className="pb-2 pr-4 font-medium text-right">Cache create</th>
            <th className="pb-2 font-medium text-right">Kosten (USD)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className="border-b border-white/10 hover:bg-white/5">
              <td className="py-2 pr-4">{tenantMap[e.tenantId] ?? 'onbekend'}</td>
              <td className="py-2 pr-4 text-white/50 text-xs">{e.model}</td>
              <td className="py-2 pr-4 text-right">{e.input.toLocaleString('nl')}</td>
              <td className="py-2 pr-4 text-right">{e.output.toLocaleString('nl')}</td>
              <td className="py-2 pr-4 text-right">{e.cache_read.toLocaleString('nl')}</td>
              <td className="py-2 pr-4 text-right">{e.cache_creation.toLocaleString('nl')}</td>
              <td className="py-2 text-right font-mono">${estimateCost(e, e.model).toFixed(4)}</td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-white/40 text-center">Geen data voor deze maand.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
