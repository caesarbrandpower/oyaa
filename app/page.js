import Link from 'next/link'

const CTA_HREF = process.env.NEXT_PUBLIC_CTA_HREF || 'mailto:hello@newfound.agency'

export const metadata = {
  title: 'Waybetter - Van aantekening naar briefing. In seconden.',
  description: 'Waybetter is een werkwijze voor je hele bureau. Van opname en aantekening tot bruikbaar document. In jullie format, in jullie toon.',
}

export default function HomePage() {
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
              className="h-9 px-5 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover shadow-orange inline-flex items-center"
            >
              Plan een gesprek
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-dark relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-orange-glow blur-[80px]" />
          <div className="absolute bottom-[-80px] right-[-100px] w-[400px] h-[400px] rounded-full bg-orange-glow opacity-60 blur-[80px]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 md:py-32 text-center">
          <span className="inline-block text-[11px] font-semibold tracking-[0.16em] uppercase text-orange mb-6">
            Voor bureaus
          </span>
          <h1 className="font-[family-name:var(--font-lexend)] text-5xl md:text-7xl font-extrabold text-white leading-[1.0] tracking-tight mb-6">
            Van aantekening<br />naar briefing.<br />In seconden.
          </h1>
          <p className="text-text-muted text-lg md:text-xl max-w-xl mx-auto mb-10 leading-relaxed">
            Waybetter is een werkwijze voor je hele bureau. Van opname en aantekening tot bruikbaar document. In jullie format, in jullie toon.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={CTA_HREF}
              className="h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover shadow-orange hover:shadow-[0_6px_24px_rgba(255,72,0,0.3)] active:scale-[0.98] inline-flex items-center justify-center"
            >
              Plan een gesprek
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

      {/* PROBLEEM */}
      <section className="bg-warm border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="font-[family-name:var(--font-lexend)] text-3xl md:text-4xl font-extrabold text-text leading-tight tracking-tight mb-5">
            Iedereen werkt met AI.<br />Niemand op dezelfde manier.
          </h2>
          <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl">
            Op ieder bureau gebruikt iedereen AI op zijn eigen manier. De een plakt een prompt in ChatGPT, de ander gebruikt Fireflies, een derde werkt handmatig. Het werkt, maar het is geen aanpak. Je team verliest kwaliteit, snelheid en consistentie. Precies waar jullie op draaien.
          </p>
        </div>
      </section>

      {/* OPLOSSING */}
      <section className="bg-white border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="font-[family-name:var(--font-lexend)] text-3xl md:text-4xl font-extrabold text-text leading-tight tracking-tight mb-5">
            Een aanpak voor<br />het hele bureau.
          </h2>
          <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl">
            Waybetter is de manier waarop jullie samen met AI werken. Een plek waar opnames, aantekeningen en bestanden binnenkomen. Een plek waar bruikbare documenten uit rollen. In jullie toon, in jullie format. Iedereen bij jullie gebruikt dezelfde werkwijze.
          </p>
        </div>
      </section>

      {/* ALLES OP EEN PLEK */}
      <section className="bg-dark border-t border-dark-border">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="font-[family-name:var(--font-lexend)] text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
            Alles op een plek.
          </h2>
          <p className="text-text-muted text-base md:text-lg leading-relaxed max-w-2xl mb-12">
            Van het eerste gesprek met een klant tot de definitieve briefing. Waybetter brengt alles samen: opnemen, verwerken, documenteren. Zonder tools te wisselen, zonder bestanden te kopiëren.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                nr: '01',
                title: 'Gooi er alles in.',
                body: 'Aantekeningen, een opgenomen gesprek, een video call, een bestand. Alles werkt.',
              },
              {
                nr: '02',
                title: 'Kies wat je nodig hebt.',
                body: 'Briefing, samenvatting, actiepunten. Jij bepaalt het resultaat.',
              },
              {
                nr: '03',
                title: 'Klaar voor gebruik.',
                body: 'Direct bruikbaar voor je team of klant. Kopieer, download of stuur door.',
              },
            ].map(({ nr, title, body }) => (
              <div
                key={nr}
                className="bg-dark-card border border-dark-border rounded-2xl p-7"
              >
                <div className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.1em] text-orange mb-4">
                  {nr}
                </div>
                <h3 className="font-[family-name:var(--font-lexend)] text-base font-bold text-white mb-2 leading-snug">
                  {title}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
