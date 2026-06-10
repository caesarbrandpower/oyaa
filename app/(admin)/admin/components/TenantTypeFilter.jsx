'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const TYPES = [
  { value: 'klant', label: 'Klanten' },
  { value: 'staging', label: 'Staging' },
  { value: 'intern', label: 'Intern' },
  { value: 'inactief', label: 'Inactief' },
  { value: 'alle', label: 'Alle' },
];

export default function TenantTypeFilter({ current }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value === 'klant') {
      params.delete('showType');
    } else {
      params.set('showType', e.target.value);
    }
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`);
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      className="text-xs bg-white/5 border border-white/15 rounded-full px-3 py-1.5 text-white/60 cursor-pointer hover:border-white/25 focus:outline-none"
    >
      {TYPES.map((t) => (
        <option key={t.value} value={t.value} className="bg-[#1c1c1c]">
          {t.label}
        </option>
      ))}
    </select>
  );
}
