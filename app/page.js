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

      {/* OP MAAT */}
      <section className="bg-warm border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="font-[family-name:var(--font-lexend)] text-3xl md:text-4xl font-extrabold text-text leading-tight tracking-tight mb-5">
            Waybetter past zich aan jullie werk aan. Niet andersom.
          </h2>
          <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl mb-12">
            Elk bureau werkt anders. Een productiebureau heeft call sheets. Een reclamebureau werkt met campagne-evaluaties. Een PR-bureau schrijft persberichten in een vaste toon. Waybetter is geen tool waar je omheen moet werken. Het wordt gebouwd op jullie manier.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: 'Jullie documenttypes.',
                body: 'Van call sheet tot campagne-evaluatie. Wij bouwen de formats die jullie elke week opnieuw maken.',
              },
              {
                title: 'Jullie toon.',
                body: 'Waybetter schrijft zoals jullie schrijven. Helder, menselijk, of juist strak en formeel. Jullie stijl.',
              },
              {
                title: 'Jullie werkwijze.',
                body: 'Van intake tot debrief. Waybetter past zich aan het proces van jullie bureau aan.',
              },
            ].map(({ title, body }) => (
              <div
                key={title}
                className="bg-white border border-border rounded-2xl p-6 shadow-sm"
              >
                <h3 className="font-[family-name:var(--font-lexend)] text-sm font-bold text-text mb-2">
                  {title}
                </h3>
                <p className="text-text-sec text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-text-muted text-sm italic">
            We bouwen jullie Waybetter-omgeving tijdens de onboarding. Niet met templates, maar met jullie echte werk.
          </p>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="bg-white border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="font-[family-name:var(--font-lexend)] text-3xl md:text-4xl font-extrabold text-text leading-tight tracking-tight mb-12">
            Wat Waybetter nu doet,<br />en wat er komt.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="border border-border rounded-2xl overflow-hidden">
              <div className="bg-orange px-5 py-3">
                <span className="font-[family-name:var(--font-lexend)] text-[10px] font-bold tracking-[0.14em] uppercase text-white">
                  Nu live
                </span>
              </div>
              <ul className="divide-y divide-border">
                {[
                  'Opnemen: audio, video-calls, bestanden uploaden',
                  'Samenvatting, briefing, debrief voor team, klant, leverancier of directie',
                  'Eigen omgeving met jullie logo en branding',
                  'Eigen subdomein (bureau.waybetter.nl)',
                  'Privacy-filter: gevoelige informatie wordt geanonimiseerd voor AI-verwerking',
                ].map((item) => (
                  <li key={item} className="px-5 py-3 text-sm text-text leading-snug">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden">
              <div className="bg-warm px-5 py-3">
                <span className="font-[family-name:var(--font-lexend)] text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
                  Komt eraan
                </span>
              </div>
              <ul className="divide-y divide-border">
                {[
                  'Bureau-eigen documenttypes (call sheets, persberichten, backplanningen)',
                  'Automatische detectie van meetings (desktop-app)',
                  'Synchronisatie met Google Drive, Dropbox en SharePoint',
                  'Mobiele opname via app',
                ].map((item) => (
                  <li key={item} className="px-5 py-3 text-sm text-text-sec leading-snug">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden">
              <div className="bg-warm px-5 py-3">
                <span className="font-[family-name:var(--font-lexend)] text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
                  Later dit jaar
                </span>
              </div>
              <ul className="divide-y divide-border">
                {[
                  'Strategische tools binnen Waybetter: marktscan, hookfinder, merkcheck',
                  'Integraties met jullie bestaande systemen (Gmail, Outlook, Notion)',
                  'Live meeting-bots voor Zoom, Teams en Google Meet',
                ].map((item) => (
                  <li key={item} className="px-5 py-3 text-sm text-text-sec leading-snug">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* VOOR WIE */}
      <section className="bg-warm border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="font-[family-name:var(--font-lexend)] text-3xl md:text-4xl font-extrabold text-text leading-tight tracking-tight mb-12">
            Voor bureaus die slim willen werken.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                title: 'Activatie- en eventbureaus',
                body: 'Van meeting naar briefing zonder handmatig uitwerken.',
              },
              {
                title: 'Productiebureaus',
                body: 'Call sheets, backplanningen en leveranciersbriefings in een klik.',
              },
              {
                title: 'Reclame- en brandingbureaus',
                body: 'Van klantgesprek naar campagne-evaluatie.',
              },
              {
                title: 'PR- en communicatiebureaus',
                body: 'Persberichten, debriefs en klantrapportages.',
              },
            ].map(({ title, body }) => (
              <div
                key={title}
                className="bg-white border border-border rounded-2xl p-6 shadow-sm"
              >
                <h3 className="font-[family-name:var(--font-lexend)] text-sm font-bold text-text mb-1.5">
                  {title}
                </h3>
                <p className="text-text-sec text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRIVACY */}
      <section className="bg-white border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="font-[family-name:var(--font-lexend)] text-3xl md:text-4xl font-extrabold text-text leading-tight tracking-tight mb-5">
            Je klantgegevens blijven van jou.
          </h2>
          <p className="text-text-sec text-base leading-relaxed mb-10">
            Waybetter filtert namen, merknamen en gevoelige informatie automatisch voordat AI ze ziet. AVG-compliant. Geen gedoe.
          </p>
          <div className="bg-warm border border-border rounded-2xl p-6 md:p-8 space-y-5">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-2">
                Jouw input
              </p>
              <div className="bg-white border border-border rounded-xl px-4 py-3 text-sm text-text leading-relaxed">
                Volgende week presenteren we aan Erik van Coca-Cola. Budget is 180.000 euro.
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-2">
                Wat AI ziet
              </p>
              <div className="bg-white border border-border rounded-xl px-4 py-3 text-sm text-text leading-relaxed">
                Volgende week presenteren we aan{' '}
                <span className="bg-orange text-white rounded px-1.5 py-0.5 text-[11px] font-semibold">[PERSOON_1]</span>{' '}
                van{' '}
                <span className="bg-orange text-white rounded px-1.5 py-0.5 text-[11px] font-semibold">[BEDRIJF_1]</span>.
                {' '}Budget is{' '}
                <span className="bg-orange text-white rounded px-1.5 py-0.5 text-[11px] font-semibold">[BEDRAG_1]</span>.
              </div>
            </div>
            <p className="text-text-muted text-xs">
              Het AI-model ziet jouw gevoelige informatie nooit. DPA beschikbaar.
            </p>
          </div>
        </div>
      </section>

      {/* PRIJS */}
      <section className="bg-dark border-t border-dark-border">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="font-[family-name:var(--font-lexend)] text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight mb-10">
            Een prijs. Alles inbegrepen.
          </h2>
          <div className="bg-dark-card border border-dark-border rounded-2xl p-8 md:p-10 max-w-lg">
            <div className="font-[family-name:var(--font-lexend)] text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-2">
              249 euro
            </div>
            <p className="text-text-muted text-sm mb-8">
              Per maand. Voor je hele bureau, tot 5 gebruikers. Geen opstartkosten.
            </p>
            <ul className="border-t border-dark-border pt-6 space-y-3 mb-8">
              {[
                'Volledige bureau-omgeving met eigen subdomein',
                'Eigen logo en branding',
                'Alle huidige documenttypes (samenvatting, briefing, debrief voor team, klant, leverancier, directie)',
                'Persoonlijke onboarding waarin we bekijken wat jullie nodig hebben',
                'Alle toekomstige features inbegrepen',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-white/70 leading-snug">
                  <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-orange" />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href={CTA_HREF}
              className="h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover shadow-orange hover:shadow-[0_6px_24px_rgba(255,72,0,0.3)] active:scale-[0.98] inline-flex items-center"
            >
              Plan een gesprek
            </a>
            <p className="mt-5 text-text-muted text-xs italic">
              Meer dan 5 gebruikers of specifieke aanpassingen voor jullie bureau? Dat bespreken we in een gesprek.
            </p>
          </div>
        </div>
      </section>

      {/* BEWIJS */}
      <section className="bg-warm border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <h2 className="font-[family-name:var(--font-lexend)] text-2xl md:text-3xl font-extrabold text-text tracking-tight mb-8">
            Bureaus die al met Waybetter werken.
          </h2>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            <span className="font-[family-name:var(--font-lexend)] text-base font-bold text-text-muted tracking-wide">
              Chase Amsterdam
            </span>
            <span className="text-text-muted text-sm">·</span>
            <span className="font-[family-name:var(--font-lexend)] text-base font-bold text-text-muted tracking-wide">
              All Day Productions
            </span>
          </div>
        </div>
      </section>

      {/* SLOT CTA */}
      <section className="bg-white border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h2 className="font-[family-name:var(--font-lexend)] text-3xl md:text-4xl font-extrabold text-text leading-tight tracking-tight mb-5">
            Benieuwd hoe Waybetter bij jullie werkt?
          </h2>
          <p className="text-text-sec text-base md:text-lg leading-relaxed mb-10 max-w-md mx-auto">
            Geen demo-praatje. Gewoon sparren over wat jullie nodig hebben.
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
              className="h-12 px-8 border-[1.5px] border-border text-text-sec rounded-lg text-sm font-semibold transition-all hover:border-text-muted hover:text-text inline-flex items-center justify-center"
            >
              Probeer het zelf
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-dark border-t border-dark-border">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <span className="font-[family-name:var(--font-lexend)] text-[10px] font-bold tracking-[0.2em] uppercase text-white/25">
            WAYBETTER · MADE FOR AGENCY PEOPLE
          </span>
          <Link href="/privacy" className="text-white/25 text-xs hover:text-white/50 transition-colors">
            Privacy &amp; data
          </Link>
        </div>
      </footer>
    </>
  )
}
