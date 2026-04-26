export const dynamic = 'force-dynamic'

import Link from 'next/link'
import ScrollReveal from '@/components/ScrollReveal'
import CountUp from '@/components/CountUp'

const CTA_HREF = process.env.NEXT_PUBLIC_CTA_HREF || 'mailto:hello@newfound.agency'

export const metadata = {
  title: 'Waybetter Preview',
  robots: { index: false },
}

export default function PreviewPage() {
  return (
    <>
      {/* HEADER */}
      <header className="bg-dark border-b border-dark-border sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.2em] uppercase text-orange">
            WAYBETTER
          </span>
          <div className="flex items-center gap-4">
            <Link href="/probeer" className="text-text-muted text-sm hover:text-white transition-colors">
              Probeer gratis
            </Link>
            <a
              href={CTA_HREF}
              className="group h-9 px-5 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover shadow-orange inline-flex items-center gap-2"
            >
              Plan een gesprek
              <span className="arrow-icon inline-block">&#8594;</span>
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="noise bg-dark relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-orange-glow blur-[100px]" />
          <div className="absolute bottom-[-80px] right-[-100px] w-[500px] h-[500px] rounded-full bg-orange-glow opacity-50 blur-[100px]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-28 md:py-40">
          <div className="animate-hero-1 flex items-center gap-3 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-orange">
              Voor bureaus
            </span>
          </div>
          <h1 className="animate-hero-2 font-[family-name:var(--font-lexend)] text-[clamp(48px,8vw,100px)] font-extrabold text-white leading-[0.95] tracking-[-0.03em] mb-8">
            Van aantekening<br />
            naar briefing.<br />
            <span className="text-orange italic">In seconden.</span>
          </h1>
          <p className="animate-hero-3 text-text-muted text-lg md:text-xl max-w-lg mb-12 leading-relaxed">
            Waybetter is een werkwijze voor je hele bureau. Van opname en aantekening tot bruikbaar document. In jullie format, in jullie toon.
          </p>
          <div className="animate-hero-4 flex flex-col sm:flex-row gap-3">
            <a
              href={CTA_HREF}
              className="group h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover animate-pulse-glow hover:shadow-[0_6px_32px_rgba(255,72,0,0.4)] active:scale-[0.98] inline-flex items-center gap-2.5"
            >
              Plan een gesprek
              <span className="arrow-icon inline-block">&#8594;</span>
            </a>
            <Link
              href="/probeer"
              className="h-12 px-8 border-[1.5px] border-white/20 text-white/70 rounded-lg text-sm font-semibold transition-all hover:border-white/50 hover:text-white inline-flex items-center justify-center"
            >
              Probeer het zelf
            </Link>
          </div>
        </div>
      </section>

      {/* CIJFERS */}
      <ScrollReveal>
        <section className="noise bg-dark border-t border-dark-border">
          <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">
            <div className="reveal mb-16 md:mb-20">
              <div className="w-12 h-[2px] bg-orange mb-8" />
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(32px,5.5vw,68px)] font-extrabold text-white leading-[1.05] tracking-[-0.02em] max-w-3xl">
                33% van je budget<br />gaat verloren aan<br />
                <span className="text-orange">slechte briefings.</span>
              </h2>
              <p className="mt-6 text-text-muted text-base md:text-lg max-w-2xl leading-relaxed">
                Wereldwijd onderzoek onder 1.700 marketeers en bureaus laat het zien. Een derde van elk budget wordt verspild door briefings die onduidelijk, incompleet of dubbelzinnig zijn.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 border border-dark-border rounded-2xl overflow-hidden reveal">
              {[
                { stat: 80, suffix: '%', label: 'van marketeers denkt dat ze goed briefen.', delay: 'reveal-delay-1' },
                { stat: 10, suffix: '%', label: 'van bureaus is het daarmee eens.', delay: 'reveal-delay-2' },
                { stat: 75, suffix: '%', label: 'van bureaus zegt dat hun laatste drie briefings niet goed genoeg waren.', delay: 'reveal-delay-3' },
              ].map(({ stat, suffix, label, delay }, i) => (
                <div
                  key={stat}
                  className={`reveal ${delay} bg-dark-card px-8 py-10 ${i < 2 ? 'md:border-r border-dark-border' : ''} ${i < 2 ? 'border-b md:border-b-0' : ''} border-dark-border`}
                >
                  <div className="font-[family-name:var(--font-lexend)] text-[clamp(52px,7vw,80px)] font-extrabold text-orange leading-none tracking-[-0.03em] mb-3">
                    <CountUp target={stat} suffix={suffix} duration={1400} />
                  </div>
                  <p className="text-text-muted text-sm leading-relaxed max-w-[200px]">{label}</p>
                </div>
              ))}
            </div>
            <div className="reveal reveal-delay-2 mt-10">
              <p className="text-white/80 text-base md:text-lg max-w-2xl leading-relaxed">
                Dat is geen briefingprobleem. Dat is een aanvang-probleem. Waybetter lost het op door elke briefing compleet en helder te maken, voordat het werk begint.
              </p>
              <p className="mt-4 text-text-muted text-xs">
                Bron: BetterBriefs Project, 2021. Onderzoek onder 1.700 marketeers en bureaus in 70 landen.
              </p>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* PLACEHOLDER — rest follows in next tasks */}
      <div className="bg-warm border-t border-border py-16 text-center">
        <p className="text-text-muted text-sm">Meer secties worden toegevoegd...</p>
      </div>
    </>
  )
}
