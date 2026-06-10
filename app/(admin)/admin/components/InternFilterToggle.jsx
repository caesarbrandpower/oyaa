'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function InternFilterToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const showInternal = searchParams.get('showInternal') === '1';

  function handleToggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (showInternal) {
      params.delete('showInternal');
    } else {
      params.set('showInternal', '1');
    }
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`);
  }

  const activeClass =
    'border-orange-500/60 text-orange-400 bg-orange-500/10';
  const inactiveClass =
    'border-white/20 text-white/50 hover:border-white/30 hover:text-white/70';

  return (
    <button
      onClick={handleToggle}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
        showInternal ? inactiveClass : activeClass
      }`}
    >
      {showInternal ? 'Intern zichtbaar' : 'Intern verborgen'}
    </button>
  );
}
