export const dynamic = 'force-dynamic'

import Link from 'next/link'
import ScrollReveal from '@/components/ScrollReveal'
import CountUp from '@/components/CountUp'
import { FileText, Building2, Shield, Mic, LayoutTemplate, MonitorPlay, HardDrive, Sparkles, Workflow } from 'lucide-react'

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

      {/* CLIENT LOGOS */}
      <section className="bg-dark border-t border-dark-border">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-white/25 mb-7 text-center">
            Al in gebruik bij
          </p>
          <div className="flex items-center justify-center gap-10 md:gap-16 flex-wrap">
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
                className="h-7 w-auto grayscale opacity-40 hover:grayscale-0 hover:opacity-80 transition-all duration-300"
              />
            ))}
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
                Internationaal onderzoek onder marketeers en bureaus laat het zien. Een derde van elk budget wordt verspild door briefings die onduidelijk, incompleet of dubbelzinnig zijn.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 border border-dark-border rounded-2xl overflow-hidden">
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
                Het probleem zit aan het begin, niet aan het einde. Waybetter lost het op door elke briefing compleet en helder te maken, voordat het werk begint.
              </p>
              <p className="mt-4 text-text-muted text-xs">
                Bron: BetterBriefs Project, internationaal onderzoek onder marketeers en bureaus.
              </p>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ROI BLOK */}
      <ScrollReveal>
        <section className="noise bg-dark border-t border-dark-border">
          <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">
            <div className="reveal relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-[#0a0a0a]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(255,72,0,0.12)_0%,transparent_70%)]" />
              <div className="absolute inset-0 border border-white/[0.06] rounded-2xl pointer-events-none" />
              <div className="relative p-8 md:p-12">
                <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(24px,3.5vw,40px)] font-extrabold text-white leading-tight tracking-tight mb-3">
                  Wat kost dit jullie bureau elke maand?
                </h2>
                <p className="text-text-muted text-base md:text-lg leading-relaxed max-w-2xl mb-10">
                  Een PM verliest gemiddeld 4 uur per week aan briefings opnieuw maken, scope-discussies en herwerk. Reken het door voor jullie bureau.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                  {[
                    { stat: '4 uur', label: 'Per week verloren, per PM' },
                    { stat: '80 uur', label: 'Per maand voor 5 PM\'s' },
                    { stat: '€6.800', label: 'Bij €85 uurtarief per maand' },
                    { stat: '€81.600', label: 'Op jaarbasis' },
                  ].map(({ stat, label }) => (
                    <div
                      key={stat}
                      className="bg-white/[0.03] border border-orange/15 rounded-xl px-5 py-6 shadow-[0_0_16px_rgba(255,72,0,0.05)]"
                    >
                      <div className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,52px)] font-extrabold text-orange leading-none tracking-tight mb-2">
                        {stat}
                      </div>
                      <p className="text-white/35 text-xs leading-snug">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="font-[family-name:var(--font-lexend)] text-base md:text-lg font-bold text-white/80 mb-6 max-w-xl leading-snug">
                  Waybetter kost €249 per maand. Eén voorkomen herbriefing verdient hem terug.
                </p>
                <a
                  href={CTA_HREF}
                  className="group h-11 px-7 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover animate-pulse-glow hover:shadow-[0_6px_32px_rgba(255,72,0,0.4)] active:scale-[0.98] inline-flex items-center gap-2"
                >
                  Reken het door voor jullie bureau
                  <span className="arrow-icon inline-block">&#8594;</span>
                </a>
                <p className="mt-6 text-white/20 text-xs leading-relaxed max-w-2xl">
                  Op basis van gemiddelden uit BetterBriefs-onderzoek en bureau-praktijk. We rekenen het samen door voor jullie situatie.
                </p>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* HELDERE AFSPRAKEN */}
      <ScrollReveal>
        <section className="bg-white border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-24">
            <div className="reveal grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
              <div>
                <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-text leading-tight tracking-tight mb-6">
                  Heldere afspraken vanaf het begin. Geen discussies achteraf.
                </h2>
                <p className="text-text-sec text-base md:text-lg leading-relaxed">
                  Het klinkt vanzelfsprekend. Maar bij veel bureaus gaat het elke week mis. Een meeting waar beide partijen met een ander verhaal weglopen. Een briefing die niet helemaal klopt. Een dubbelcheck die er niet komt. Met Waybetter ligt alles helder vast voordat het werk begint.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-4 bg-warm border border-border rounded-xl px-5 py-4">
                  <div className="shrink-0 w-2 h-2 rounded-full bg-text-muted/40 mt-2" />
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted mb-1">Zonder Waybetter</p>
                    <p className="text-text-sec text-sm leading-snug">~1 op de 3 budgetten gaat verloren aan onduidelijke of incomplete briefings.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 bg-orange/[0.04] border border-orange/20 rounded-xl px-5 py-4">
                  <div className="shrink-0 w-2 h-2 rounded-full bg-orange mt-2" />
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-orange mb-1">Met Waybetter</p>
                    <p className="text-text-sec text-sm leading-snug">Helder vastgelegd vanaf het begin. Geen herwerk. Geen discussies achteraf.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* USP STATEMENT BLOK */}
      <ScrollReveal>
        <section className="noise bg-dark border-t border-dark-border">
          <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">
            <div className="reveal mb-10 text-center">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-white leading-tight tracking-tight">
                Wat krijgt jullie bureau<br />met Waybetter?
              </h2>
            </div>
            <div className="reveal relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-[#0f0f0f]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(255,72,0,0.09)_0%,transparent_70%)]" />
              <div className="absolute inset-0 border border-white/[0.06] rounded-2xl pointer-events-none" />
              <div className="relative p-8 md:p-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {[
                    { Icon: FileText, title: 'Documenten', body: 'Briefings, debriefs, notulen, samenvattingen. En wat jullie bureau verder nodig heeft.' },
                    { Icon: Shield, title: 'Privacy', body: 'Klantgegevens worden gefilterd voordat AI ze ziet. AVG-compliant.' },
                    { Icon: Building2, title: 'Eigen omgeving', body: 'Eigen subdomein, logo en toon. Voelt als jullie eigen tool.' },
                    { Icon: Workflow, title: 'Op maat', body: 'Bureau-eigen workflows, integraties, formats. Gebouwd op jullie manier.' },
                  ].map(({ Icon, title, body }) => (
                    <div
                      key={title}
                      className="bg-white/[0.03] border border-orange/20 rounded-xl px-5 py-5 shadow-[0_0_12px_rgba(255,72,0,0.06)]"
                    >
                      <Icon className="w-4 h-4 text-orange mb-3" strokeWidth={2} />
                      <p className="font-[family-name:var(--font-lexend)] text-sm font-bold text-white mb-1.5">{title}</p>
                      <p className="text-white/50 text-sm leading-relaxed">{body}</p>
                    </div>
                  ))}
                </div>
                <p className="text-white/40 text-sm leading-relaxed mb-8 max-w-lg">
                  En dat is nog maar het begin. We bouwen Waybetter samen met jullie tot wat jullie bureau echt nodig heeft.
                </p>
                <div className="text-center">
                  <a
                    href={CTA_HREF}
                    className="group h-12 px-10 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover animate-pulse-glow hover:shadow-[0_6px_32px_rgba(255,72,0,0.4)] active:scale-[0.98] inline-flex items-center gap-2.5"
                  >
                    Plan een gesprek
                    <span className="arrow-icon inline-block">&#8594;</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* PROBLEEM */}
      <ScrollReveal>
        <section className="bg-warm border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-24">
            <div className="reveal flex gap-10 items-start">
              <div className="hidden md:block w-[3px] bg-orange self-stretch shrink-0 rounded-full mt-1" />
              <div>
                <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-text leading-tight tracking-tight mb-5">
                  Iedereen werkt met AI.<br />Niemand op dezelfde manier.
                </h2>
                <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl">
                  Op ieder bureau gebruikt iedereen AI op eigen wijze. De een plakt prompts in ChatGPT, de ander gebruikt Fireflies, een derde werkt handmatig. Het werkt, maar het is geen aanpak. Je team verliest kwaliteit, snelheid en consistentie.
                </p>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* OPLOSSING */}
      <ScrollReveal>
        <section className="bg-white border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-24">
            <div className="reveal grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div>
                <span className="inline-block text-[11px] font-semibold tracking-[0.16em] uppercase text-orange mb-4">
                  De oplossing
                </span>
                <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-text leading-tight tracking-tight mb-5">
                  Een aanpak voor<br />het hele bureau.
                </h2>
                <p className="text-text-sec text-base md:text-lg leading-relaxed">
                  Waybetter is de manier waarop jullie samen met AI werken. Een plek waar opnames, aantekeningen en bestanden binnenkomen. Een plek waar bruikbare documenten uit rollen. In jullie toon, in jullie format. Iedereen bij jullie gebruikt dezelfde werkwijze.
                </p>
              </div>
              <div>
                <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10">
                  <img
                    src="/screenshots/screenshot-allday-homepage.png"
                    alt="De bureau-omgeving van All Day Productions"
                    className="w-full h-auto block"
                  />
                </div>
                <p className="mt-3 text-text-muted text-xs leading-relaxed">
                  De bureau-omgeving van All Day Productions. Eigen logo, eigen subdomein, eigen werkwijze.
                </p>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* STAPPEN */}
      <ScrollReveal>
        <section className="noise bg-dark border-t border-dark-border">
          <div className="max-w-5xl mx-auto px-6 py-24">
            <div className="reveal mb-14">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-white leading-tight tracking-tight mb-4">
                Alles op een plek.
              </h2>
              <p className="text-text-muted text-base md:text-lg leading-relaxed max-w-xl">
                Van het eerste klantgesprek tot de definitieve briefing. Opnemen, verwerken, documenteren. Zonder tools te wisselen of bestanden te kopiëren.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { nr: '01', title: 'Gooi er alles in.', body: 'Aantekeningen, een opgenomen gesprek, een video call, een bestand. Alles werkt.' },
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

      {/* MAATWERK */}
      <ScrollReveal>
        <section className="bg-warm border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-24">
            <div className="reveal mb-14">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-text leading-tight tracking-tight mb-4">
                Waybetter past zich aan jullie werk aan. Niet andersom.
              </h2>
              <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl">
                Elk bureau werkt anders. Een productiebureau heeft call sheets. Een reclamebureau werkt met campagne-evaluaties. Een PR-bureau schrijft persberichten in een vaste toon. Waybetter is geen tool waar je omheen moet werken. Het wordt gebouwd op jullie manier.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { Icon: FileText, title: 'Jullie documenttypes.', body: 'Van call sheet tot campagne-evaluatie. Wij bouwen de formats die jullie elke week opnieuw maken.' },
                { Icon: Mic, title: 'Jullie toon.', body: 'Waybetter schrijft zoals jullie schrijven. Helder, menselijk, of juist strak en formeel. Jullie stijl.' },
                { Icon: Workflow, title: 'Jullie werkwijze.', body: 'Van intake tot debrief. Waybetter past zich aan het proces van jullie bureau aan.' },
              ].map(({ Icon, title, body }, i) => (
                <div key={title} className={`reveal reveal-delay-${i + 1} bg-white border border-border rounded-2xl p-6`}>
                  <Icon className="w-5 h-5 text-orange mb-4" strokeWidth={2} />
                  <h3 className="font-[family-name:var(--font-lexend)] text-sm font-bold text-text mb-2">{title}</h3>
                  <p className="text-text-sec text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            <p className="reveal mt-8 text-text-muted text-sm italic">
              We bouwen jullie Waybetter-omgeving tijdens de onboarding. Niet met templates, maar met jullie echte werk.
            </p>
            {/* NOG TE DOEN BLOK */}
            <div className="reveal mt-16">
              <div className="mb-8">
                <span className="inline-block text-[11px] font-semibold tracking-[0.16em] uppercase text-orange mb-3">
                  Geen briefing meer waar gaten in zitten.
                </span>
              </div>
              <div className="relative bg-white border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-orange" />
                <div className="px-8 md:px-10 py-8">
                  <p className="font-[family-name:var(--font-lexend)] text-[10px] font-bold tracking-[0.2em] uppercase text-text-muted mb-7">
                    Nog te doen voor een complete briefing
                  </p>
                  <ol className="space-y-5">
                    {[
                      { nr: 1, tag: 'AFSTEMMEN MET KLANT', type: 'red', text: 'Wat is het exacte budget voor deze campagne?' },
                      { nr: 2, tag: 'NOG NIET CONCREET GENOEG', type: 'amber', text: '"We willen meer awareness". Welke KPI\'s meten we?' },
                      { nr: 3, tag: 'AFSTEMMEN MET KLANT', type: 'red', text: 'Wie is de hoofddoelgroep en wat is hun pijn?' },
                      { nr: 4, tag: 'WIE GAAT DIT DOEN?', type: 'amber', text: 'Aanleveren van de huidige campagne-uitingen.' },
                      { nr: 5, tag: 'AFSTEMMEN MET KLANT', type: 'red', text: 'Wat is de gewenste opleverdatum?' },
                      { nr: 6, tag: 'NAVRAGEN BIJ LEVERANCIER', type: 'red', text: 'Beschikbaarheid mediabureau eind oktober?' },
                    ].map(({ nr, tag, type, text }) => (
                      <li key={nr} className="flex items-start gap-4">
                        <span className="shrink-0 w-5 h-5 rounded-full border border-border flex items-center justify-center mt-0.5">
                          <span className="font-[family-name:var(--font-lexend)] text-[9px] font-bold text-text-muted leading-none">{nr}</span>
                        </span>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-[9px] font-bold tracking-[0.12em] uppercase whitespace-nowrap ${
                            type === 'red'
                              ? 'bg-orange/10 text-orange ring-1 ring-orange/25'
                              : 'bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/25'
                          }`}>
                            {tag}
                          </span>
                          <span className="text-text-sec text-sm leading-snug">{text}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <p className="mt-3 text-text-muted text-xs">
                Waybetter wijst aan wat ontbreekt. Aanvullen doe je zelf.
              </p>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ROADMAP */}
      <ScrollReveal>
        <section className="bg-white border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-24">
            <div className="reveal mb-14">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-text leading-tight tracking-tight mb-4">
                Waybetter groeit met je mee.
              </h2>
              <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl">
                Wat je vandaag krijgt blijft werken. Desktop-app, integraties en slimme tools komen erbij, zonder extra kosten.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              <div className="reveal reveal-delay-1">
                <p className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.16em] uppercase text-orange mb-8">
                  Wat je nu krijgt
                </p>
                <ul className="space-y-7">
                  {[
                    { Icon: Mic, title: 'Opnemen en transcriberen', body: 'Audio, video-calls, bestanden uploaden.' },
                    { Icon: FileText, title: 'Briefings, debriefs en samenvattingen', body: 'Met labels die laten zien wat nog ontbreekt.' },
                    { Icon: Building2, title: 'Jullie eigen omgeving', body: 'Eigen subdomein, logo en toon.' },
                    { Icon: Shield, title: 'Privacy en AVG', body: 'Gevoelige info wordt gefilterd voordat AI hem ziet.' },
                  ].map(({ Icon, title, body }) => (
                    <li key={title} className="flex items-start gap-4">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-orange/10 border border-orange/20 flex items-center justify-center mt-0.5">
                        <Icon className="w-4 h-4 text-orange" strokeWidth={2} />
                      </div>
                      <div>
                        <p className="font-[family-name:var(--font-lexend)] text-sm font-bold text-text mb-1">{title}</p>
                        <p className="text-text-sec text-sm leading-relaxed">{body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="reveal reveal-delay-2">
                <p className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.16em] uppercase text-text-muted mb-8">
                  Wat er bij komt
                </p>
                <ul className="space-y-7">
                  {[
                    { Icon: LayoutTemplate, title: 'Bureau-eigen documenttypes', body: 'Call sheets, persberichten, eigen formats.' },
                    { Icon: MonitorPlay, title: 'Desktop-app met meeting-detectie', body: 'Automatisch opnemen wanneer een meeting begint.' },
                    { Icon: HardDrive, title: 'Koppelingen met Drive en SharePoint', body: 'Documenten landen waar je ze nodig hebt.', integrations: true },
                    { Icon: Sparkles, title: 'Strategische tools binnen Waybetter', body: 'Marktscan, hookfinder, merkcheck.' },
                  ].map(({ Icon, title, body, integrations }) => (
                    <li key={title} className="flex items-start gap-4">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-warm border border-border flex items-center justify-center mt-0.5">
                        <Icon className="w-4 h-4 text-text-muted" strokeWidth={2} />
                      </div>
                      <div>
                        <p className="font-[family-name:var(--font-lexend)] text-sm font-bold text-text-sec mb-1">{title}</p>
                        <p className="text-text-sec text-sm leading-relaxed">{body}</p>
                        {integrations && (
                          <div className="mt-3">
                            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-2">Werkt straks met:</p>
                            <div className="flex items-center gap-3 flex-wrap">
                              {[
                                { src: '/logos/integrations/google-drive.svg', alt: 'Google Drive' },
                                { src: '/logos/integrations/sharepoint.svg', alt: 'SharePoint' },
                                { src: '/logos/integrations/notion.svg', alt: 'Notion' },
                                { src: '/logos/integrations/zoom.svg', alt: 'Zoom' },
                                { src: '/logos/integrations/microsoft-teams.svg', alt: 'Microsoft Teams' },
                                { src: '/logos/integrations/google-meet.svg', alt: 'Google Meet' },
                              ].map(({ src, alt }) => (
                                <img key={alt} src={src} alt={alt} title={alt} className="h-6 w-6 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-200" />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* VOOR WIE */}
      <ScrollReveal>
        <section className="noise bg-dark border-t border-dark-border">
          <div className="max-w-5xl mx-auto px-6 py-24">
            <div className="reveal mb-12">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-white leading-tight tracking-tight">
                Voor elk type bureau.
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { title: 'Reclame- en brandingbureaus', body: 'Van klantgesprek naar campagne-evaluatie.' },
                { title: 'Activatie- en eventbureaus', body: 'Van meeting naar briefing zonder handmatig uitwerken.' },
                { title: 'PR- en communicatiebureaus', body: 'Persberichten, debriefs en klantrapportages.' },
                { title: 'Productiebureaus', body: 'Call sheets, backplanningen en leveranciersbriefings in een klik.' },
              ].map(({ title, body }, i) => (
                <div
                  key={title}
                  className={`reveal reveal-delay-${i + 1} bg-dark-card border border-dark-border rounded-2xl p-5`}
                >
                  <h3 className="font-[family-name:var(--font-lexend)] text-sm font-bold text-white mb-2 leading-snug">{title}</h3>
                  <p className="text-text-muted text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* PRIVACY */}
      <ScrollReveal>
        <section className="bg-white border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <div className="reveal grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div className="rounded-xl overflow-hidden shadow-xl ring-1 ring-black/10">
                <img
                  src="/screenshots/screenshot-privacy-block.png"
                  alt="Anonimisering: gevoelige data wordt verborgen voor het AI-model"
                  className="w-full h-auto block"
                />
              </div>
              <div>
                <p className="text-text-sec text-base leading-relaxed">
                  Klantgegevens worden gefilterd voordat AI ze ziet. Namen, merknamen en bedragen worden vervangen door placeholders. AVG-compliant. DPA beschikbaar.
                </p>
              </div>
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
                      'Strategische tools (marktscan, hookfinder, merkcheck) inbegrepen',
                      'Eigen Waybetter-strateeg als contactpersoon',
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
              <p className="text-text-muted text-xs italic max-w-2xl">
                De setup-fee voor Custom hangt af van wat we voor jullie bouwen. We bespreken het in een gesprek voor je beslist. Meer dan 5 gebruikers? Dat bespreken we ook.
              </p>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* SLOT CTA */}
      <ScrollReveal>
        <section className="noise bg-dark border-t border-dark-border">
          <div className="max-w-3xl mx-auto px-6 py-28 text-center">
            <div className="reveal">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,5vw,56px)] font-extrabold text-white leading-tight tracking-tight mb-5">
                Benieuwd hoe Waybetter<br />bij jullie werkt?
              </h2>
              <p className="text-text-muted text-base md:text-lg leading-relaxed mb-10 max-w-md mx-auto">
                We sparren graag over wat jullie nodig hebben. Waybetter is gemaakt voor en door bureau-mensen. We kennen jullie wereld en weten waar jullie tegenaan lopen.
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
                  className="h-12 px-8 border-[1.5px] border-white/20 text-white/70 rounded-lg text-base font-semibold transition-all hover:border-white/50 hover:text-white inline-flex items-center justify-center"
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
          <span className="font-[family-name:var(--font-lexend)] text-[10px] font-bold tracking-[0.2em] uppercase text-white/25">
            WAYBETTER &#183; MADE FOR AGENCY PEOPLE
          </span>
          <Link href="/privacy" className="text-white/25 text-xs hover:text-white/50 transition-colors">
            Privacy &amp; data
          </Link>
        </div>
      </footer>
    </>
  )
}
