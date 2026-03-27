export default function Footer() {
  return (
    <footer className="bg-[#1F1F1F] text-white/55 py-7 text-[13px]">
      <div className="max-w-[800px] mx-auto px-8 flex justify-between items-center gap-4 flex-wrap">
        <span>&copy; 2026 <strong className="text-white font-medium">Oyaa</strong> — Made for agency people</span>
        <a href="/privacy" className="text-white/40 no-underline hover:text-white/70 transition-colors">
          Privacy &amp; data
        </a>
        <span className="text-white/30 tracking-wide">oyaa.nl</span>
      </div>
    </footer>
  );
}
