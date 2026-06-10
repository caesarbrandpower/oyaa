// app/(admin)/admin/feedback/page.jsx
import { createServiceClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

async function updateStatus(formData) {
  'use server';
  const id = formData.get('id');
  const status = formData.get('status');
  if (!id || !['nieuw', 'gelezen', 'afgehandeld'].includes(status)) return;
  const service = createServiceClient();
  await service.from('feedback').update({ status }).eq('id', id);
  revalidatePath('/admin/feedback');
}

const STATUS_LABELS = {
  nieuw: 'Nieuw',
  gelezen: 'Gelezen',
  afgehandeld: 'Afgehandeld',
};

const STATUS_COLORS = {
  nieuw: 'text-yellow-400',
  gelezen: 'text-blue-400',
  afgehandeld: 'text-green-400',
};

export default async function AdminFeedbackPage() {
  const service = createServiceClient();
  const { data: rows } = await service
    .from('feedback')
    .select('id, tenant_id, user_email, page_url, message, status, created_at, tenants(name)')
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Feedback</h1>

      {(!rows || rows.length === 0) && (
        <p className="text-white/40">Nog geen feedback ontvangen.</p>
      )}

      <div className="flex flex-col gap-4">
        {(rows ?? []).map((row) => (
          <div key={row.id} className="border border-white/10 rounded-lg p-4 bg-white/5">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="text-sm">
                <span className="font-medium">{row.user_email}</span>
                {row.tenants?.name && (
                  <span className="ml-2 text-white/40">({row.tenants.name})</span>
                )}
                <span className="ml-2 text-white/30 text-xs">
                  {new Date(row.created_at).toLocaleString('nl-NL')}
                </span>
              </div>
              <span className={`text-xs font-medium ${STATUS_COLORS[row.status] ?? 'text-white/40'}`}>
                {STATUS_LABELS[row.status] ?? row.status}
              </span>
            </div>

            {row.page_url && (
              <p className="text-xs text-white/30 mb-2 truncate">{row.page_url}</p>
            )}

            <p className="text-sm text-white/80 whitespace-pre-wrap mb-3">{row.message}</p>

            <form action={updateStatus} className="flex gap-2">
              <input type="hidden" name="id" value={row.id} />
              <select
                name="status"
                defaultValue={row.status}
                className="bg-[#0d0d0d] border border-white/20 rounded px-2 py-1 text-xs text-white"
              >
                <option value="nieuw">Nieuw</option>
                <option value="gelezen">Gelezen</option>
                <option value="afgehandeld">Afgehandeld</option>
              </select>
              <button
                type="submit"
                className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
              >
                Opslaan
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
