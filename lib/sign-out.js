import { createClient } from '@/lib/supabase-browser';

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();

  if (typeof window !== 'undefined' && window.__TAURI__) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('sign_out');
    return;
  }

  window.location.href = '/login';
}
