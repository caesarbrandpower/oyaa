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
          <div className="flex items-center gap-2">
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
                { title: 'Jullie documenttypes.', body: 'Van call sheet tot campagne-evaluatie. Wij bouwen de formats die jullie elke week opnieuw maken.' },
                { title: 'Jullie toon.', body: 'Waybetter schrijft zoals jullie schrijven. Helder, menselijk, of juist strak en formeel. Jullie stijl.' },
                { title: 'Jullie werkwijze.', body: 'Van intake tot debrief. Waybetter past zich aan het proces van jullie bureau aan.' },
              ].map(({ title, body }, i) => (
                <div key={title} className={`reveal reveal-delay-${i + 1} bg-white border border-border rounded-2xl p-6`}>
                  <div className="w-1 h-8 bg-orange rounded-full mb-4" />
                  <h3 className="font-[family-name:var(--font-lexend)] text-sm font-bold text-text mb-2">{title}</h3>
                  <p className="text-text-sec text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
            {/* Screenshot input-flow */}
            <div className="reveal mt-10">
              <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10">
                <img
                  src="/screenshots/screenshot-input-flow.png"
                  alt="Input-flow: drie outputs, bureau-eigen formats"
                  className="w-full h-auto block"
                />
              </div>
              <p className="mt-3 text-text-muted text-xs">
                Drie outputs. Bureau-eigen formats. Allemaal op een plek.
              </p>
            </div>
            <p className="reveal mt-8 text-text-muted text-sm italic">
              We bouwen jullie Waybetter-omgeving tijdens de onboarding. Niet met templates, maar met jullie echte werk.
            </p>
            {/* NOG TE DOEN BLOK */}
            <div className="reveal mt-16">
              <div className="mb-8">
                <span className="inline-block text-[11px] font-semibold tracking-[0.16em] uppercase text-orange mb-3">
                  Geen briefing meer waar later gaten in zitten.
                </span>
                <p className="text-text-sec text-sm leading-relaxed max-w-xl">
                  Waybetter wijst aan wat nog ontbreekt voordat het werk begint. Met labels die laten zien wat afgestemd, uitgezocht of nagevraagd moet worden.
                </p>
              </div>
              <div className="relative rounded-2xl overflow-hidden">
                {/* Achtergrond: donker met subtiele radiale glow */}
                <div className="absolute inset-0 bg-[#0f0f0f]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(255,72,0,0.07)_0%,transparent_70%)]" />
                <div className="absolute inset-0 border border-white/[0.06] rounded-2xl pointer-events-none" />
                <div className="relative p-7 md:p-10">
                  <p className="font-[family-name:var(--font-lexend)] text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 mb-7">
                    Nog te doen voor een complete briefing
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                    {[
                      { tag: 'AFSTEMMEN MET KLANT', type: 'red', text: 'Wat is het exacte budget voor deze campagne?' },
                      { tag: 'NOG NIET CONCREET GENOEG', type: 'amber', text: '"We willen meer awareness". Welke KPI\'s meten we?' },
                      { tag: 'AFSTEMMEN MET KLANT', type: 'red', text: 'Wie is de hoofddoelgroep en wat is hun pijn?' },
                      { tag: 'WIE GAAT DIT DOEN?', type: 'amber', text: 'Aanleveren van de huidige campagne-uitingen.' },
                      { tag: 'AFSTEMMEN MET KLANT', type: 'red', text: 'Wat is de gewenste opleverdatum?' },
                      { tag: 'NAVRAGEN BIJ LEVERANCIER', type: 'red', text: 'Beschikbaarheid mediabureau voor productie eind oktober.' },
                    ].map(({ tag, type, text }, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className={`shrink-0 mt-0.5 inline-flex items-center px-2.5 py-1 rounded-md text-[9px] font-bold tracking-[0.12em] uppercase whitespace-nowrap shadow-sm ${
                          type === 'red'
                            ? 'bg-orange/10 text-orange ring-1 ring-orange/25 shadow-[0_0_8px_rgba(255,72,0,0.15)]'
                            : 'bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/25 shadow-[0_0_8px_rgba(251,191,36,0.12)]'
                        }`}>
                          {tag}
                        </span>
                        <span className="text-white/60 text-sm leading-snug">{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
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
                    { Icon: HardDrive, title: 'Koppelingen met Drive en SharePoint', body: 'Documenten landen waar je ze nodig hebt.' },
                    { Icon: Sparkles, title: 'Strategische tools binnen Waybetter', body: 'Marktscan, hookfinder, merkcheck.' },
                  ].map(({ Icon, title, body }) => (
                    <li key={title} className="flex items-start gap-4">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-warm border border-border flex items-center justify-center mt-0.5">
                        <Icon className="w-4 h-4 text-text-muted" strokeWidth={2} />
                      </div>
                      <div>
                        <p className="font-[family-name:var(--font-lexend)] text-sm font-bold text-text-sec mb-1">{title}</p>
                        <p className="text-text-sec text-sm leading-relaxed">{body}</p>
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
                Voor bureaus die slim willen werken.
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { title: 'Activatie- en eventbureaus', body: 'Van meeting naar briefing zonder handmatig uitwerken.' },
                { title: 'Productiebureaus', body: 'Call sheets, backplanningen en leveranciersbriefings in een klik.' },
                { title: 'Reclame- en brandingbureaus', body: 'Van klantgesprek naar campagne-evaluatie.' },
                { title: 'PR- en communicatiebureaus', body: 'Persberichten, debriefs en klantrapportages.' },
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
          <div className="max-w-3xl mx-auto px-6 py-24">
            <div className="reveal mb-10">
              <span className="inline-block text-[11px] font-semibold tracking-[0.16em] uppercase text-orange mb-4">AVG-compliant</span>
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,44px)] font-extrabold text-text leading-tight tracking-tight mb-4">
                Je klantgegevens blijven van jou.
              </h2>
              <p className="text-text-sec text-base leading-relaxed">
                Waybetter filtert namen, merknamen en gevoelige informatie automatisch voordat AI ze ziet. AVG-compliant. Geen gedoe.
              </p>
            </div>
            <div className="reveal">
              <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10">
                <img
                  src="/screenshots/screenshot-privacy-block.png"
                  alt="Anonimisering: gevoelige data wordt verborgen voor het AI-model"
                  className="w-full h-auto block"
                />
              </div>
              <p className="mt-3 text-text-muted text-xs">
                Het AI-model ziet jouw gevoelige informatie nooit. DPA beschikbaar.
              </p>
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
                Een prijs. Alles inbegrepen.
              </h2>
            </div>
            <div className="reveal max-w-lg">
              <div className="relative bg-dark-card border border-orange/20 rounded-2xl p-8 md:p-10 shadow-[0_0_60px_rgba(255,72,0,0.08)]">
                <div className="absolute left-0 top-8 bottom-8 w-[3px] bg-orange rounded-r-full" />
                <div className="inline-flex items-center gap-1.5 bg-orange/10 border border-orange/20 rounded-full px-3 py-1 mb-6">
                  <span className="w-1 h-1 rounded-full bg-orange" />
                  <span className="text-orange text-[11px] font-semibold tracking-wide">Geen verrassingen</span>
                </div>
                <div className="font-[family-name:var(--font-lexend)] text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-2">
                  249 euro
                </div>
                <p className="text-text-muted text-sm mb-8">
                  Per maand. Voor je hele bureau, tot 5 gebruikers. Geen opstartkosten.
                </p>
                <ul className="border-t border-dark-border pt-6 space-y-3 mb-8">
                  {[
                    'Volledige bureau-omgeving met eigen subdomein en branding',
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
                <p className="mt-5 text-text-muted text-xs italic">
                  Meer dan 5 gebruikers of specifieke aanpassingen voor jullie bureau? Dat bespreken we in een gesprek.
                </p>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* BEWIJS */}
      <ScrollReveal>
        <section className="bg-warm border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <div className="reveal flex flex-wrap items-center gap-3 md:gap-6">
              <span className="font-[family-name:var(--font-lexend)] text-xs font-bold tracking-[0.14em] uppercase text-text-muted">
                Al in gebruik bij
              </span>
              <div className="h-px flex-1 bg-border hidden md:block" />
              <span className="font-[family-name:var(--font-lexend)] text-base font-bold text-text-sec">Chase Amsterdam</span>
              <span className="text-border text-sm">&#183;</span>
              <span className="font-[family-name:var(--font-lexend)] text-base font-bold text-text-sec">All Day Productions</span>
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
                Geen demo-praatje. Gewoon sparren over wat jullie nodig hebben.
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
