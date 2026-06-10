// app/api/cron/token-budget-check/route.js
import { createServiceClient } from '@/lib/supabase-server';

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Verboden.' }, { status: 401 });
  }

  const service = createServiceClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: usageRows }, { data: tenants }] = await Promise.all([
    service
      .from('token_usage')
      .select('tenant_id, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens')
      .gte('created_at', monthStart)
      .not('tenant_id', 'is', null),
    service.from('tenants').select('id, name, tenant_config'),
  ]);

  // Som per tenant
  const usagePerTenant = {};
  for (const row of usageRows ?? []) {
    usagePerTenant[row.tenant_id] = (usagePerTenant[row.tenant_id] ?? 0) +
      row.input_tokens + row.output_tokens + row.cache_read_tokens + row.cache_creation_tokens;
  }

  const alerts = [];
  for (const tenant of tenants ?? []) {
    const budget = tenant.tenant_config?.monthly_token_budget;
    if (!budget || budget <= 0) continue;
    const used = usagePerTenant[tenant.id] ?? 0;
    const pct = used / budget;
    if (pct >= 0.8) {
      alerts.push({ name: tenant.name, used, budget, pct: Math.round(pct * 100), tenant });
    }
  }

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (const alert of alerts) {
    // Skip if we already alerted this month
    if (alert.tenant.tenant_config?.last_budget_alert_month === currentMonth) continue;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Waybetter Admin <onboarding@resend.dev>',
        to: 'mailtocaesar@gmail.com',
        subject: `Waybetter: ${alert.name} op ${alert.pct}% van maandbudget`,
        html: `<p><strong>${alert.name}</strong> heeft ${alert.used.toLocaleString('nl-NL')} van ${alert.budget.toLocaleString('nl-NL')} tokens verbruikt (${alert.pct}%) deze maand.</p>`,
      }),
    });
    if (!res.ok) {
      console.error('[cron] Resend failed for', alert.name, res.status);
      continue;
    }
    // Mark alert sent for this month
    const updatedConfig = { ...alert.tenant.tenant_config, last_budget_alert_month: currentMonth };
    await service.from('tenants').update({ tenant_config: updatedConfig }).eq('id', alert.tenant.id);
  }

  return Response.json({ checked: Object.keys(usagePerTenant).length, alerts: alerts.length });
}
