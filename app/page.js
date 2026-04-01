import Footer from '@/components/Footer';
import PublicTranscriptForm from '@/components/PublicTranscriptForm';

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative bg-dark overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] rounded-full bg-orange/[0.05] blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[15%] w-[400px] h-[400px] rounded-full bg-orange/[0.03] blur-[100px]" />
        </div>

        <div className="relative max-w-[900px] mx-auto px-8 pt-[100px] pb-16 max-[640px]:pt-[72px] max-[640px]:pb-12">
          <div className="animate-hero-1">
            <div className="inline-flex items-center gap-2.5 mb-8">
              <span className="font-[family-name:var(--font-lexend)] text-[11px] tracking-[0.2em] font-semibold text-orange uppercase">Waybetter</span>
              <span className="text-orange text-[14px]">&middot;</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange font-[family-name:var(--font-outfit)]">Made for agency people</span>
            </div>
          </div>

          <h1 className="animate-hero-2 font-[family-name:var(--font-lexend)] text-[clamp(36px,6.5vw,68px)] font-extrabold leading-[1.06] tracking-[-0.025em] text-white mb-7">
            Van aantekening{'\u00A0'}
            <br className="max-[640px]:hidden" />
            naar briefing.
            <br />
            <span className="text-orange">In seconden.</span>
          </h1>

          <p className="animate-hero-3 text-[17px] text-white/50 leading-[1.65] max-w-[540px] font-[family-name:var(--font-outfit)]">
            Waybetter verwerkt je aantekeningen, opgenomen gesprekken en bestanden naar direct bruikbare documenten voor je team of klant. In jouw format, in jouw toon.
          </p>
        </div>
      </section>

      <PublicTranscriptForm />

      <Footer />
    </>
  );
}
