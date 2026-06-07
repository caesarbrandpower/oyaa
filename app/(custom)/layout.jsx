// app/(custom)/layout.jsx
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import FeedbackWidget from '@/components/custom/FeedbackWidget';

export const dynamic = 'force-dynamic';

export default async function CustomLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="h-screen overflow-hidden bg-[#0d0d0d]">
      {children}
      <FeedbackWidget userEmail={user.email} />
    </div>
  );
}
