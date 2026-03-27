import Footer from '@/components/Footer';
import PublicTranscriptForm from '@/components/PublicTranscriptForm';

export default function Home() {
  return (
    <>
      <section className="bg-hero py-[88px] pb-20 border-b border-orange-mid">
        <div className="max-w-[800px] mx-auto px-8">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-orange mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange" />
            Voor accountmanagers bij reclamebureaus
          </div>
          <h1 className="font-[family-name:var(--font-lexend)] text-[64px] font-bold leading-[1.05] tracking-tight text-text mb-5">
            Oyaa<span className="text-orange">.</span>
          </h1>
          <p className="text-xl text-text-sec leading-relaxed max-w-[520px]">
            Van gesprek naar geregeld, in minuten. Stop met uitwerken, begin met doen.
          </p>
        </div>
      </section>

      <div className="max-w-[800px] mx-auto px-8 py-14">
        <PublicTranscriptForm />
      </div>

      <Footer />
    </>
  );
}
