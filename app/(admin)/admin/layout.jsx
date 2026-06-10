// app/(admin)/admin/layout.jsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (user.app_metadata?.role !== 'admin') redirect('/');

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <nav className="border-b border-white/10 px-8 py-4 flex items-center gap-6 text-sm">
        <span className="font-bold text-base mr-2">Waybetter Admin</span>
        <Link href="/admin" className="text-white/60 hover:text-white transition-colors">Overzicht</Link>
        <Link href="/admin/tokens" className="text-white/60 hover:text-white transition-colors">Tokens</Link>
        <Link href="/admin/feedback" className="text-white/60 hover:text-white transition-colors">Feedback</Link>
      </nav>
      <main className="px-8 py-6">{children}</main>
    </div>
  );
}
