export const dynamic = 'force-dynamic'

import Link from 'next/link'
import ScrollReveal from '@/components/ScrollReveal'
import CountUp from '@/components/CountUp'
import { FileText, Shield, Mic, LayoutTemplate, Workflow, TrendingUp, AlertCircle } from 'lucide-react'

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
          <div className="flex items-center gap-2.5">
            <img src="/icons/waybetter-icon.svg" alt="Waybetter" className="h-8 w-8 rounded-md shrink-0" />
            <span className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.2em] uppercase text-orange">
              WAYBETTER
            </span>
            <span className="text-white/25 text-[11px]">&#183;</span>
            <span className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.2em] uppercase text-white/40">
              MADE FOR AGENCY PEOPLE
            </span>
          </div>
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
              Voor bureaus die structureel beter willen werken
            </span>
          </div>
          <h1 className="animate-hero-2 font-[family-name:var(--font-lexend)] text-[clamp(48px,8vw,100px)] font-extrabold text-white leading-[0.95] tracking-[-0.03em] mb-8">
            Van aantekening<br />
            naar briefing.<br />
            <span className="text-orange italic">In seconden.</span>
          </h1>
          <p className="animate-hero-3 text-text-muted text-lg md:text-xl max-w-lg mb-12 leading-relaxed">
            Waybetter zet gesprekken om in briefings, debriefs, notulen en samenvattingen. Helder vastgelegd, intern en extern. In jullie format, in jullie toon.
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

      {/* PIJN */}
      <ScrollReveal>
        <section className="bg-warm border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">

            {/* Bovenste deel — herkenning */}
            <div className="reveal mb-16 md:mb-20">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(36px,5.5vw,64px)] font-extrabold text-text leading-tight tracking-tight mb-6">
                Je kent het wel.
              </h2>
              <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl">
                Een goede meeting met de klant. Iedereen knikt. Een week later staat er in de mail iets anders dan je dacht dat was afgesproken. De briefing is gemaakt, maar er zitten gaten in. Dingen die niet besproken zijn, of half. Aan het eind van het project ben je twee discussies en drie correctierondes verder.
              </p>
            </div>

            {/* Onderste deel — cijfer-bevestiging */}
            <div className="reveal border-t border-border pt-12 md:pt-16">
              <p className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.16em] uppercase text-orange mb-6">
                Onderzoek bevestigt het.
              </p>

              {/* Groot ankercijfer */}
              <div className="mb-6">
                <div className="font-[family-name:var(--font-lexend)] text-[clamp(80px,14vw,120px)] font-extrabold text-orange leading-none tracking-[-0.03em]">
                  33%
                </div>
                <p className="text-text text-xl md:text-2xl font-semibold mt-2 max-w-xl leading-snug">
                  Verloren aan slechte briefings.
                </p>
              </div>

              <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl mb-8">
                <span className="font-semibold text-text">80%</span> van marketeers denkt goed te briefen, maar slechts{' '}
                <span className="font-semibold text-text">10%</span> van bureaus is het daarmee eens.{' '}
                <span className="font-semibold text-text">75%</span> van bureaus zegt dat hun laatste drie briefings niet goed genoeg waren.
              </p>

              <p className="text-text-sec text-sm md:text-base leading-relaxed mb-2">
                Een Project Manager of Account Manager is gemiddeld 4 uur per week kwijt aan dit soort gedoe. Zonde.
              </p>
              <p className="text-text-sec text-sm md:text-base leading-relaxed mb-6">
                <a href={CTA_HREF} className="text-orange hover:text-orange-hover transition-colors underline underline-offset-2">
                  Benieuwd wat Waybetter kan besparen? &#8594;
                </a>
              </p>

              <p className="text-text-muted text-xs">
                Bron: BetterBriefs Project, internationaal onderzoek onder marketeers en bureaus.
              </p>
            </div>

          </div>
        </section>
      </ScrollReveal>

      {/* WAT IS WAYBETTER */}
      <ScrollReveal>
        <section className="noise bg-dark border-t border-dark-border">
          <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">

            <div className="reveal mb-12">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-white leading-tight tracking-tight mb-4">
                Heldere afspraken, vanaf de eerste meeting.
              </h2>
              <p className="text-text-muted text-base md:text-lg leading-relaxed max-w-2xl">
                Waybetter neemt op, verwerkt, en levert documenten die er meteen goed uitzien. In jullie format, in jullie toon. Met markeringen die laten zien wat nog ontbreekt.
              </p>
            </div>

            {/* Zes voordelen in twee kolommen */}
            <div className="reveal grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 mb-12">
              {[
                { Icon: Mic, title: 'Niets meer\nhoeven typen', body: 'Audio, video-calls, presentaties of meetings op kantoor.' },
                { Icon: LayoutTemplate, title: 'Eigen omgeving\nper bureau', body: 'Eigen subdomein en logo. Voelt als jullie eigen tool.' },
                { Icon: FileText, title: 'Documenten die er\nmeteen goed uitzien', body: 'Briefings en debriefs in jullie format, in jullie toon.' },
                { Icon: Shield, title: 'Klantgegevens\nbeschermd', body: 'Privacy-filtering voor AI. AVG-compliant.' },
                { Icon: AlertCircle, title: 'Geen briefings meer\nwaar gaten in zitten', body: 'Waybetter wijst aan wat nog ontbreekt.' },
                { Icon: TrendingUp, title: 'Werkt vandaag,\ngroeit mee', body: 'Desktop-app en integraties komen erbij zonder extra kosten.' },
              ].map(({ Icon, title, body }) => (
                <div key={title} className="grid grid-cols-1 md:grid-cols-[96px_1fr] items-start border border-dark-border rounded-lg p-4 md:p-5 bg-dark-card hover:border-orange/40 transition-colors duration-200">
                  <div className="flex items-center justify-start md:justify-center mb-3 md:mb-0">
                    <Icon className="w-10 h-10 text-orange" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-[family-name:var(--font-lexend)] text-base font-semibold text-white mb-1 whitespace-pre-line">{title}</p>
                    <p className="text-text-muted text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="reveal">
              <Link
                href="/probeer"
                className="group h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover animate-pulse-glow hover:shadow-[0_6px_32px_rgba(255,72,0,0.4)] active:scale-[0.98] inline-flex items-center gap-2.5"
              >
                Probeer het zelf
                <span className="arrow-icon inline-block">&#8594;</span>
              </Link>
            </div>

          </div>
        </section>
      </ScrollReveal>

      {/* HOE WERKT HET */}
      <ScrollReveal>
        <section className="noise bg-dark border-t border-dark-border">
          <div className="max-w-5xl mx-auto px-6 py-24">
            <div className="reveal mb-14">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-white leading-tight tracking-tight">
                Hoe werkt het?
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { nr: '01', title: 'Voeg je input toe.', body: 'Aantekeningen, een opgenomen gesprek, een video call, een bestand. Alles werkt.' },
                { nr: '02', title: 'Kies wat je nodig hebt.', body: 'Briefing, samenvatting, actiepunten. Jij bepaalt het resultaat.' },
                { nr: '03', title: 'Klaar voor gebruik.', body: 'Direct bruikbaar voor je team of klant. Kopieer, download of stuur door.' },
              ].map(({ nr, title, body }, i) => (
                <div
                  key={nr}
                  className={`reveal reveal-delay-${i + 1} group bg-dark-card border border-dark-border rounded-2xl p-7 hover:border-orange/40 transition-colors duration-300`}
                >
                  <div className="w-9 h-9 rounded-full border border-orange/40 flex items-center justify-center mb-5 group-hover:border-orange transition-colors duration-300">
                    <span className="font-[family-name:var(--font-lexend)] text-[11px] font-bold text-orange">{nr}</span>
                  </div>
                  <h3 className="font-[family-name:var(--font-lexend)] text-base font-bold text-white mb-2 leading-snug">{title}</h3>
                  <p className="text-text-muted text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* JULLIE BUREAU */}
      <ScrollReveal>
        <section className="bg-warm border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-24">

            <div className="reveal mb-10">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-text leading-tight tracking-tight mb-4">
                Voor elk type bureau.
              </h2>
              <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl">
                Reclame, productie, PR, activatie, communicatie. Elk bureau werkt anders.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { title: 'Reclame- en brandingbureaus', body: 'Van klantgesprek naar campagne-evaluatie.' },
                { title: 'Activatie- en eventbureaus', body: 'Van meeting naar briefing zonder handmatig uitwerken.' },
                { title: 'PR- en communicatiebureaus', body: 'Persberichten, debriefs en klantrapportages.' },
                { title: 'Productiebureaus', body: 'Call sheets, backplanningen en leveranciersbriefings.' },
              ].map(({ title, body }, i) => (
                <div
                  key={title}
                  className={`reveal reveal-delay-${i + 1} bg-white border border-border rounded-2xl p-5`}
                >
                  <h3 className="font-[family-name:var(--font-lexend)] text-sm font-bold text-text mb-2 leading-snug">{title}</h3>
                  <p className="text-text-sec text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

          </div>
        </section>
      </ScrollReveal>

      {/* BEWIJS */}
      <ScrollReveal>
        <section className="bg-warm border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-14">
            <div className="reveal text-center mb-8">
              <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-text-muted">
                Werken al met Waybetter
              </p>
            </div>
            <div className="reveal flex flex-wrap justify-center items-center gap-10 md:gap-16">
              {[
                { src: '/logos/chase-amsterdam.svg', alt: 'Chase Amsterdam' },
                { src: '/logos/all-day-productions.svg', alt: 'All Day Productions' },
                { src: '/logos/de-wolven.svg', alt: 'De Wolven' },
                { src: '/logos/newfound.svg', alt: 'Newfound' },
              ].map(({ src, alt }) => (
                <img
                  key={alt}
                  src={src}
                  alt={alt}
                  className="h-7 w-auto object-contain invert opacity-50 hover:opacity-90 transition-all duration-300"
                />
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* PRIJS */}
      <ScrollReveal>
        <section className="noise bg-dark border-t border-dark-border">
          <div className="max-w-5xl mx-auto px-6 py-24">
            <div className="reveal mb-12">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-white leading-tight tracking-tight">
                Kies wat bij jullie bureau past.
              </h2>
            </div>
            <div className="reveal grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Pakket 1: Waybetter Start */}
              <div className="relative bg-dark-card border border-orange/20 rounded-2xl p-8 shadow-[0_0_60px_rgba(255,72,0,0.08)]">
                <div className="absolute left-0 top-8 bottom-8 w-[3px] bg-orange rounded-r-full" />
                <div className="inline-flex items-center gap-1.5 bg-orange/10 border border-orange/20 rounded-full px-3 py-1 mb-6">
                  <span className="w-1 h-1 rounded-full bg-orange" />
                  <span className="text-orange text-[11px] font-semibold tracking-wide">Geen verrassingen</span>
                </div>
                <p className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted mb-2">
                  Waybetter Start
                </p>
                <div className="font-[family-name:var(--font-lexend)] text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-1">
                  249 euro
                </div>
                <p className="text-text-muted text-sm mb-8">
                  Per maand. Voor je hele bureau, tot 5 gebruikers. Geen opstartkosten. Maandelijks opzegbaar.
                </p>
                <ul className="border-t border-dark-border pt-6 space-y-3 mb-8">
                  {[
                    'Volledige bureau-omgeving met eigen subdomein en inlog',
                    'Alle huidige documenttypes (samenvatting, briefing, debrief)',
                    'Persoonlijke onboarding op maat van jullie werkwijze',
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
                  className="group h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover animate-pulse-glow hover:shadow-[0_6px_32px_rgba(255,72,0,0.4)] active:scale-[0.98] inline-flex items-center gap-2"
                >
                  Plan een gesprek
                  <span className="arrow-icon inline-block">&#8594;</span>
                </a>
              </div>
              {/* Pakket 2: Waybetter Custom */}
              <div className="relative bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-8 shadow-[0_0_80px_rgba(255,72,0,0.05)] overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(255,72,0,0.06)_0%,transparent_70%)] pointer-events-none" />
                <div className="relative">
                  <div className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.10] rounded-full px-3 py-1 mb-6">
                    <span className="w-1 h-1 rounded-full bg-white/40" />
                    <span className="text-white/60 text-[11px] font-semibold tracking-wide">Volledig op maat</span>
                  </div>
                  <p className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted mb-2">
                    Waybetter Custom
                  </p>
                  <div className="font-[family-name:var(--font-lexend)] text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-1">
                    vanaf 499 euro
                  </div>
                  <p className="text-text-muted text-sm mb-8">
                    Setup in overleg. Maandelijks opzegbaar.
                  </p>
                  <ul className="border-t border-white/[0.06] pt-6 space-y-3 mb-8">
                    {[
                      'Alles van Waybetter Start',
                      'Bureau-eigen documenttypes (call sheets, persberichten, eigen formats)',
                      'Tone-of-voice training op jullie schrijfstijl',
                      'Workflow-integraties (Drive, SharePoint, Notion)',
                      'Meedenken over wat er nog meer voor jullie bureau mogelijk is',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm text-white/70 leading-snug">
                        <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-white/30" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={CTA_HREF}
                    className="group h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover animate-pulse-glow hover:shadow-[0_6px_32px_rgba(255,72,0,0.4)] active:scale-[0.98] inline-flex items-center gap-2"
                  >
                    Plan een gesprek
                    <span className="arrow-icon inline-block">&#8594;</span>
                  </a>
                </div>
              </div>
            </div>
            <div className="reveal reveal-delay-2 mt-8">
              <p className="text-text-muted text-sm md:text-base leading-relaxed max-w-2xl mb-2">
                Setup-fee voor Custom bespreken we in een gesprek, op basis van wat we voor jullie bouwen.
              </p>
              <p className="text-text-muted text-sm md:text-base leading-relaxed max-w-2xl">
                Meer dan 5 gebruikers? Geen probleem, ook dat bespreken we.
              </p>
            </div>
          </div>
        </section>
      </ScrollReveal>


      {/* SLOT CTA */}
      <ScrollReveal>
        <section className="bg-warm border-t border-border">
          <div className="max-w-3xl mx-auto px-6 py-28 text-center">
            <div className="reveal">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,5vw,56px)] font-extrabold text-text leading-tight tracking-tight mb-5">
                Wil je beter werken<br />met Waybetter?
              </h2>
              <p className="text-text-sec text-base md:text-lg leading-relaxed mb-10 max-w-md mx-auto">
                We kennen jullie wereld en weten waar jullie tegenaan lopen. We sparren graag over wat jullie nodig hebben. Waybetter is gemaakt voor en door bureau-mensen.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href={CTA_HREF}
                  className="group h-12 px-10 bg-orange text-white rounded-lg text-base font-semibold transition-all hover:bg-orange-hover animate-pulse-glow hover:shadow-[0_6px_32px_rgba(255,72,0,0.4)] active:scale-[0.98] inline-flex items-center gap-2.5"
                >
                  Plan een gesprek
                  <span className="arrow-icon inline-block">&#8594;</span>
                </a>
                <Link
                  href="/probeer"
                  className="h-12 px-8 border-[1.5px] border-border text-text-sec rounded-lg text-base font-semibold transition-all hover:border-text hover:text-text inline-flex items-center justify-center"
                >
                  Probeer het zelf
                </Link>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* FOOTER */}
      <footer className="bg-dark border-t border-dark-border">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/icons/waybetter-icon.svg" alt="" aria-hidden="true" className="h-7 w-7 opacity-25" />
            <span className="font-[family-name:var(--font-lexend)] text-[10px] font-bold tracking-[0.2em] uppercase text-white/25">
              WAYBETTER &#183; MADE FOR AGENCY PEOPLE
            </span>
          </div>
          <Link href="/privacy" className="text-white/25 text-xs hover:text-white/50 transition-colors">
            Privacy &amp; data
          </Link>
        </div>
      </footer>
    </>
  )
}
