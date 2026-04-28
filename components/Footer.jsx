export default function Footer() {
  return (
    <footer className="bg-dark py-8 text-[13px] font-[family-name:var(--font-outfit)]">
      <div className="max-w-[900px] mx-auto px-8 flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <img src="/icons/waybetter-icon.svg" alt="" aria-hidden="true" className="h-[26px] w-[26px] opacity-25" />
          <span className="font-[family-name:var(--font-lexend)] text-[10px] font-bold tracking-[0.2em] uppercase text-white/25">
            WAYBETTER &middot; MADE FOR AGENCY PEOPLE
          </span>
        </div>
        <a
          href="/privacy"
          className="text-white/30 no-underline hover:text-white/55 transition-colors"
        >
          Privacy &amp; data
        </a>
      </div>
    </footer>
  );
}
