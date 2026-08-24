import { createClient } from '@/lib/supabase-browser';

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();

  if (typeof window !== 'undefined' && window.__TAURI__) {
    await window.__TAURI__.core.invoke('sign_out');
    return;
  }

  window.location.href = '/login';
}
