export default function TenantBadge({ tenant, children }) {
  if (!tenant?.logo_url) return null;

  return (
    <div className="w-full bg-[#0d0d0d] border-b border-white/[0.06]" style={{ height: '52px' }}>
      <div className="max-w-[900px] mx-auto px-8 h-full flex items-center justify-between">
        <img
          src={tenant.logo_url}
          alt={tenant.name}
          style={{ height: '20px', width: 'auto' }}
        />
        <div className="flex items-center gap-5">
          {children}
          <span className="text-[10px] tracking-[0.1em] uppercase text-white/25 font-[family-name:var(--font-outfit)]">
            Powered by Waybetter
          </span>
        </div>
      </div>
    </div>
  );
}
