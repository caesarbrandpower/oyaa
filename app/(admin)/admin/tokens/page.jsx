// app/(admin)/admin/tokens/page.jsx
import { Suspense } from 'react';
import { createServiceClient } from '@/lib/supabase-server';
import { getInternalUserIds } from '@/lib/admin-config';
import InternFilterToggle from '../components/InternFilterToggle';
import TokenDayChart from '../components/TokenDayChart';
import ModelDistChart from '../components/ModelDistChart';
import CostMeter from '../components/CostMeter';

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
  const showInternal = params?.showInternal === '1';

  const monthStart = new Date(year, month - 1, 1).toISOString();
  const monthEnd   = new Date(year, month, 1).toISOString();

  const service = createServiceClient();

  const [{ data: tenants }, { data: rows }, internalIds] = await Promise.all([
    service.from('tenants').select('id, name, tenant_config'),
    service
      .from('token_usage')
      .select('tenant_id, user_id, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, created_at')
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd),
    getInternalUserIds(service),
  ]);

  const tenantMap = Object.fromEntries((tenants ?? []).map((t) => [t.id, t]));

  // Filter interne gebruikers
  const filteredRows = (rows ?? []).filter((row) => {
    if (!showInternal && row.user_id && internalIds.has(row.user_id)) return false;
    return true;
  });

  // Aggregeer per tenant + model voor de tabel
  const agg = {};
  for (const row of filteredRows) {
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
    const na = tenantMap[a.tenantId]?.name ?? '';
    const nb = tenantMap[b.tenantId]?.name ?? '';
    return na.localeCompare(nb) || a.model.localeCompare(b.model);
  });

  const totalCost = entries.reduce((sum, e) => sum + estimateCost(e, e.model), 0);

  // Bereid data voor TokenDayChart: groepeer op dag van de maand
  const dayAgg = {};
  for (const row of filteredRows) {
    const day = row.created_at ? row.created_at.slice(8, 10) : '??';
    if (!dayAgg[day]) dayAgg[day] = { day, input: 0, output: 0 };
    dayAgg[day].input  += row.input_tokens;
    dayAgg[day].output += row.output_tokens;
  }
  const dayData = Object.values(dayAgg).sort((a, b) => a.day.localeCompare(b.day));

  // Bereid data voor ModelDistChart: groepeer op model
  const modelAgg = {};
  for (const row of filteredRows) {
    if (!modelAgg[row.model]) modelAgg[row.model] = { model: row.model, tokens: 0 };
    modelAgg[row.model].tokens += row.input_tokens + row.output_tokens;
  }
  const modelData = Object.values(modelAgg).sort((a, b) => b.tokens - a.tokens);

  // Bereid data voor CostMeters: som tokens per tenant
  const tenantTokens = {};
  for (const row of filteredRows) {
    if (!row.tenant_id) continue;
    tenantTokens[row.tenant_id] = (tenantTokens[row.tenant_id] ?? 0) +
      row.input_tokens + row.output_tokens + row.cache_read_tokens + row.cache_creation_tokens;
  }

  // Tenants met een budget
  const tenantsWithBudget = (tenants ?? []).filter(
    (t) => t.tenant_config?.monthly_token_budget > 0
  );

  const monthLabel = new Date(year, month - 1, 1).toLocaleString('nl', { month: 'long', year: 'numeric' });

  // Prev/next maand links
  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const prevHref = `/admin/tokens?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}`;
  const nextHref = `/admin/tokens?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}`;

  return (
    <div>
      {/* Rij 1: maandselector + intern toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Token-verbruik</h1>
          <a href={prevHref} className="text-white/40 hover:text-white text-sm">vorige</a>
          <span className="text-white/80 text-sm font-medium capitalize">{monthLabel}</span>
          <a href={nextHref} className="text-white/40 hover:text-white text-sm">volgende</a>
        </div>
        <Suspense fallback={null}>
          <InternFilterToggle />
        </Suspense>
      </div>

      {/* Rij 2: totale kostenregel */}
      <p className="text-white/50 text-sm mb-4">
        Geschatte totale kosten: <strong className="text-white">${totalCost.toFixed(4)}</strong>
        {' '}Tarieven zijn indicatief, verifieer via Anthropic pricing.
      </p>

      {/* Rij 3: CostMeters per tenant met budget */}
      {tenantsWithBudget.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {tenantsWithBudget.map((tenant) => (
            <CostMeter
              key={tenant.id}
              label={tenant.name}
              used={tenantTokens[tenant.id] ?? 0}
              total={tenant.tenant_config.monthly_token_budget}
              formatValue={(n) => n.toLocaleString('nl') + ' tok'}
            />
          ))}
        </div>
      )}

      {/* Rij 4: grafieken */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-sm text-white/50 mb-3">Verbruik per dag</p>
          <TokenDayChart data={dayData} />
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-sm text-white/50 mb-3">Verdeling per model</p>
          <ModelDistChart data={modelData} />
        </div>
      </div>

      {/* Rij 5: details tabel */}
      <h2 className="text-lg font-semibold mb-3">Details</h2>
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
              <td className="py-2 pr-4">{tenantMap[e.tenantId]?.name ?? 'onbekend'}</td>
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
