export default function Footer({ allday = false }) {
  if (allday) {
    return (
      <footer className="bg-dark py-8 text-[13px] font-[family-name:var(--font-outfit)]">
        <div className="max-w-[900px] mx-auto px-8 flex justify-between items-center gap-4 flex-wrap">
          <span className="text-[11px] tracking-wider uppercase">
            <span className="text-orange font-semibold">Waybetter</span>
            <span className="text-white/30"> &middot; Made for agency people</span>
          </span>
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

  return (
    <footer className="bg-dark text-white/35 py-8 text-[13px] font-[family-name:var(--font-outfit)]">
      <div className="max-w-[900px] mx-auto px-8 flex justify-between items-center gap-4 flex-wrap">
        <span>
          <strong className="text-white/55 font-medium">Waybetter</strong>
          {' '}&mdash; gemaakt door{' '}
          <a
            href="https://newfound.agency"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/55 hover:text-orange transition-colors no-underline"
          >
            Newfound
          </a>
        </span>
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
