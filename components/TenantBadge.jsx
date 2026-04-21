export default function TenantBadge({ tenant }) {
  if (!tenant?.logo_url) return null;

  // Encode + as %2B to prevent storage servers from interpreting it as a space
  const logoSrc = tenant.logo_url.replace(/\+/g, '%2B');

  return (
    <div className="w-full bg-[#0d0d0d] border-b border-white/[0.06]" style={{ height: '52px' }}>
      <div className="max-w-[900px] mx-auto px-8 h-full flex items-center justify-between">
        <img
          src={logoSrc}
          alt={tenant.name}
          style={{ height: '20px', width: 'auto' }}
        />
        <span className="text-[10px] tracking-[0.1em] uppercase text-white/40 font-[family-name:var(--font-outfit)]">
          Powered by Waybetter
        </span>
      </div>
    </div>
  );
}
