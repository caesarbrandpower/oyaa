export default function Footer() {
  return (
    <footer className="bg-dark text-white/35 py-8 text-[13px] font-[family-name:var(--font-outfit)]">
      <div className="max-w-[900px] mx-auto px-8 flex justify-between items-center gap-4 flex-wrap">
        <span>
          Gemaakt door{' '}
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
