export const dynamic = 'force-dynamic'

import Link from 'next/link'
import TryToolPage from '@/components/TryToolPage'
import { getTenant } from '@/lib/get-tenant'
import ScrollReveal from '@/components/ScrollReveal'
import { FileText, Shield, Database, Layers, Users, TrendingUp, AlertTriangle, LayoutGrid, Brain, Mic, Video, FileUp, PenLine, ShieldCheck, CheckCircle, Lock } from 'lucide-react'

const DEFAULT_HOSTNAME = 'waybetter.nl'
const CTA_HREF = process.env.NEXT_PUBLIC_CTA_HREF || 'mailto:hello@waybetter.nl'

export const metadata = {
  title: 'Waybetter. Made for agency people',
  description: 'Waybetter brengt klantcontext, documenten en je bestaande tools samen op één plek. Begin met betere briefings, groei door naar een bureau-agent die met jullie werkwijze meedenkt.',
}

export const viewport = {
  themeColor: '#0d0d0d',
}

export default async function HomePage() {
  const tenant = await getTenant()
  const isDefaultTenant = !tenant || tenant.hostname === DEFAULT_HOSTNAME

  if (!isDefaultTenant) {
    return <TryToolPage tenant={tenant} />
  }

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
            <span className="hidden md:inline text-white/25 text-[11px]">&#183;</span>
            <span className="hidden md:inline font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.2em] uppercase text-white/40">
              MADE FOR AGENCY PEOPLE
            </span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <a href="mailto:hello@waybetter.nl?subject=Waybetter%20probeer%20aanvraag" className="hidden sm:inline text-text-muted text-sm hover:text-white transition-colors">
              Probeer het zelf
            </a>
            <a
              href={CTA_HREF}
              className="h-9 px-4 md:px-5 bg-orange text-white rounded-lg text-xs md:text-sm font-semibold transition-all hover:bg-orange-hover shadow-orange inline-flex items-center gap-1.5 md:gap-2"
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
          <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[900px] h-[700px]" style={{ background: 'radial-gradient(ellipse at center, rgba(255,72,0,0.18) 0%, rgba(255,72,0,0.06) 40%, transparent 70%)' }} />
          <div className="absolute bottom-[-80px] right-[-100px] w-[600px] h-[600px]" style={{ background: 'radial-gradient(ellipse at center, rgba(255,72,0,0.10) 0%, rgba(255,72,0,0.03) 40%, transparent 70%)' }} />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-28 md:py-40">
          <div className="animate-hero-1 flex items-center gap-3 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-orange">
              Voor bureaus die structureel beter willen werken
            </span>
          </div>
          <h1 className="animate-hero-2 font-[family-name:var(--font-lexend)] text-[clamp(44px,7vw,92px)] font-extrabold text-white leading-[0.95] tracking-[-0.03em] mb-8">
            Van losse tools<br />
            naar&#160;&#233;&#233;n <span className="text-orange">werkomgeving.</span>
          </h1>
          <p className="animate-hero-3 text-text-muted text-lg md:text-xl max-w-xl mb-12 leading-relaxed">
            &#201;&#233;n werkomgeving voor je hele bureau, waar documenten, klantkennis en je tools samenkomen. Vandaag voor betere briefings, morgen een volledige bureau-agent.
          </p>
          <div className="animate-hero-4 flex flex-col sm:flex-row gap-3">
            <a
              href={CTA_HREF}
              className="h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover animate-pulse-glow hover:shadow-[0_6px_32px_rgba(255,72,0,0.4)] active:scale-[0.98] inline-flex items-center gap-2.5"
            >
              Plan een gesprek
              <span className="arrow-icon inline-block">&#8594;</span>
            </a>
            <a
              href="mailto:hello@waybetter.nl?subject=Waybetter%20probeer%20aanvraag"
              className="h-12 px-8 border-[1.5px] border-white/20 text-white/70 rounded-lg text-sm font-semibold transition-all hover:border-white/50 hover:text-white inline-flex items-center justify-center"
            >
              Probeer het zelf
            </a>
          </div>
        </div>
      </section>

      {/* PIJN */}
      <ScrollReveal>
        <section className="bg-warm border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">

            <div className="reveal mb-8">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(36px,5.5vw,64px)] font-extrabold text-text leading-tight tracking-tight mb-4">
                Je kent het wel.
              </h2>
              <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl">
                Drie dingen die elk bureau herkent.
              </p>
            </div>

            <div className="reveal flex flex-col gap-8 md:gap-12">

              {/* Pijn 1 */}
              <div className="border-t border-border pt-10">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="w-7 h-7 text-orange shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div>
                    <h3 className="font-[family-name:var(--font-lexend)] text-lg md:text-xl font-bold text-text mb-3 leading-snug">
                      Slechte briefings, eindeloos herwerk
                    </h3>
                    <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl">
                      Iedereen knikt in de meeting. Een week later staat er iets anders in de mail. Briefings met gaten, scope-discussies halverwege, correctierondes aan het eind.
                    </p>
                  </div>
                </div>
              </div>

              {/* Pijn 2 */}
              <div className="border-t border-border pt-10">
                <div className="flex items-start gap-4">
                  <LayoutGrid className="w-7 h-7 text-orange shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div>
                    <h3 className="font-[family-name:var(--font-lexend)] text-lg md:text-xl font-bold text-text mb-3 leading-snug">
                      Te veel losse tools, geen overzicht
                    </h3>
                    <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl">
                      Drive, Word, Notion, een AI-tab, een ander systeem. Mensen kopi&#235;ren en plakken, verliezen context. Wat &#233;&#233;n plek had moeten zijn, zijn tien losse eilandjes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Pijn 3 */}
              <div className="border-t border-border pt-10">
                <div className="flex items-start gap-4">
                  <Brain className="w-7 h-7 text-orange shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div>
                    <h3 className="font-[family-name:var(--font-lexend)] text-lg md:text-xl font-bold text-text mb-3 leading-snug">
                      Bureau-kennis die niet vastligt
                    </h3>
                    <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl">
                      Welke leverancier had de juiste vergunning? Wat was de tone of voice voor die klant? Bureau-kennis zit in hoofden, niet in systemen. Iedere nieuwe medewerker begint vanaf nul.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* WAT IS WAYBETTER */}
      <ScrollReveal>
        <section className="noise bg-dark border-t border-dark-border">
          <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">

            <div className="reveal mb-12">
              <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                <img
                  src="/icons/waybetter-icon.svg"
                  alt=""
                  aria-hidden="true"
                  className="w-20 h-20 md:w-[100px] md:h-[100px] shrink-0 rounded-2xl"
                />
                <div>
                  <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-white leading-tight tracking-tight mb-4">
                    Heldere afspraken,<br />
                    vanaf de eerste meeting.
                  </h2>
                  <p className="text-text-muted text-base md:text-lg leading-relaxed">
                    Waybetter is &#233;&#233;n werkomgeving voor je hele bureau. Documenten, vragen, klantcontext; allemaal op &#233;&#233;n plek. Werkt vandaag aan briefings, groeit mee tot een bureau-agent die meedenkt en met jullie tools praat.
                  </p>
                </div>
              </div>
            </div>

            {/* 6 gelijke voordelen — 3x2 grid */}
            <div className="reveal grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-12">
              {[
                {
                  Icon: FileText,
                  title: 'Documenten zonder gaten erin',
                  body: 'Briefings, debriefs en samenvattingen in jullie format en toon. Met markeringen die laten zien wat nog ontbreekt.',
                },
                {
                  Icon: Layers,
                  title: '&#201;&#233;n plek voor je bureau-werk',
                  body: 'Geen tools wisselen meer. Vraag het, Waybetter regelt het. Met jullie tone of voice, klantcontext en bestaande tools.',
                },
                {
                  Icon: Database,
                  title: 'Kennis die w&#233;l blijft hangen',
                  body: 'Tone of voice, klanten, projecten, leveranciers. Waybetter onthoudt het, je hele team profiteert ervan.',
                },
                {
                  Icon: Users,
                  title: 'Eigen omgeving per bureau',
                  body: 'Eigen subdomein en logo. Voelt als jullie eigen tool.',
                },
                {
                  Icon: Shield,
                  title: 'Klantgegevens beschermd',
                  body: 'Privacy-filtering voor AI. AVG-compliant.',
                },
                {
                  Icon: TrendingUp,
                  title: 'Werkt vandaag, groeit mee',
                  body: 'Integraties en uitbreidingen erbij zonder extra kosten.',
                },
              ].map(({ Icon, title, body }) => (
                <div key={title} className="flex flex-col gap-4 border border-dark-border rounded-xl p-6 bg-dark-card hover:border-orange/40 transition-colors duration-200">
                  <Icon className="w-6 h-6 text-orange shrink-0" strokeWidth={1.5} />
                  <div>
                    <p className="font-[family-name:var(--font-lexend)] text-base font-bold text-white mb-2 leading-snug" dangerouslySetInnerHTML={{ __html: title }} />
                    <p className="text-text-muted text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="reveal">
              <a
                href="mailto:hello@waybetter.nl?subject=Waybetter%20probeer%20aanvraag"
                className="h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover animate-pulse-glow hover:shadow-[0_6px_32px_rgba(255,72,0,0.4)] active:scale-[0.98] inline-flex items-center gap-2.5"
              >
                Probeer het zelf
                <span className="arrow-icon inline-block">&#8594;</span>
              </a>
            </div>

          </div>
        </section>
      </ScrollReveal>

      {/* HOE WERKT HET */}
      <ScrollReveal>
        <section className="bg-warm border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-24">
            <div className="reveal mb-14">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-text leading-tight tracking-tight">
                Hoe werkt het?
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { nr: '01', title: 'Voeg je input toe.', body: 'Spreek in, neem een meeting op, plak een transcript van een video-call of upload een bestand. Aantekeningen tikken kan ook.', icons: [Mic, Video, FileUp, PenLine] },
                { nr: '02', title: 'Kies wat je nodig hebt.', body: 'Briefing, samenvatting, actiepunten of gewoon een vraag stellen. Jij bepaalt het resultaat.' },
                { nr: '03', title: 'Klaar voor gebruik.', body: 'Direct bruikbaar voor je team of klant. Kopieer, download of stuur door.' },
              ].map(({ nr, title, body, icons }, i) => (
                <div
                  key={nr}
                  className={`reveal reveal-delay-${i + 1} group bg-white border border-border rounded-2xl p-7 hover:border-orange/40 transition-colors duration-300`}
                >
                  <div className="w-9 h-9 rounded-full border border-orange/40 flex items-center justify-center mb-5 group-hover:border-orange transition-colors duration-300">
                    <span className="font-[family-name:var(--font-lexend)] text-[11px] font-bold text-orange">{nr}</span>
                  </div>
                  <h3 className="font-[family-name:var(--font-lexend)] text-base font-bold text-text mb-2 leading-snug">{title}</h3>
                  <p className="text-text-sec text-sm leading-relaxed">{body}</p>
                  {icons && (
                    <div className="flex gap-3 mt-5 pt-4 border-t border-border">
                      {icons.map((Icon, idx) => (
                        <Icon key={idx} className="w-6 h-6 text-orange/70" strokeWidth={1.5} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* TWEE NIVEAUS */}
      <ScrollReveal>
        <section className="noise bg-dark border-t border-dark-border">
          <div className="max-w-5xl mx-auto px-6 py-24">
            <div className="reveal mb-4">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-white leading-tight tracking-tight">
                Twee niveaus van Waybetter.
              </h2>
            </div>
            <div className="reveal mb-12">
              <p className="text-text-muted text-base md:text-lg leading-relaxed">
                Begin met Waybetter Start. Groei door naar Waybetter Custom: een volledige bureau-agent die meedenkt, vragen beantwoordt en taken overneemt.
              </p>
            </div>
            <div className="reveal grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

              {/* Waybetter Start */}
              <div className="group relative bg-dark-card border border-orange/40 rounded-2xl p-8 shadow-[0_0_60px_rgba(255,72,0,0.12)] overflow-hidden">
                <div className="absolute left-0 top-8 bottom-8 w-[3px] bg-orange rounded-r-full" />
                <div className="inline-flex items-center gap-1.5 bg-orange/10 border border-orange/20 rounded-full px-3 py-1 mb-6">
                  <span className="w-1 h-1 rounded-full bg-orange" />
                  <span className="text-orange text-[11px] font-semibold tracking-wide">Snel beginnen</span>
                </div>
                <p className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted mb-2">
                  Waybetter Start
                </p>
                <div className="font-[family-name:var(--font-lexend)] text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-1">
                  &#8364;249
                </div>
                <p className="text-text-muted text-sm mb-1">
                  per maand
                </p>
                <p className="text-white/35 text-xs leading-relaxed mb-8">
                  Setup-fee in overleg. Maandelijks opzegbaar.
                </p>
                <ul className="border-t border-dark-border pt-6 space-y-3 mb-8">
                  {[
                    'Drie standaard documenttypes: briefing, samenvatting, debrief',
                    'Eigen subdomein en logo',
                    'Vijf gebruikers',
                    'Persoonlijke onboarding voor jullie team',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-white/70 leading-snug">
                      <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-orange" />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href={CTA_HREF}
                  className="h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover animate-pulse-glow hover:shadow-[0_6px_32px_rgba(255,72,0,0.4)] active:scale-[0.98] inline-flex items-center gap-2"
                >
                  Plan een gesprek
                  <span className="arrow-icon inline-block">&#8594;</span>
                </a>
              </div>

              {/* Waybetter Custom */}
              <div className="group relative bg-dark-card border border-dark-border rounded-2xl p-8 transition-all duration-300 hover:border-orange/40 hover:shadow-[0_0_40px_rgba(255,72,0,0.15)] overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(255,72,0,0.05)_0%,transparent_70%)] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className="inline-flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] rounded-full px-3 py-1 mb-6 group-hover:bg-orange/10 group-hover:border-orange/20 transition-colors duration-300">
                    <span className="w-1 h-1 rounded-full bg-white/40 group-hover:bg-orange transition-colors duration-300" />
                    <span className="text-white/60 text-[11px] font-semibold tracking-wide group-hover:text-orange transition-colors duration-300">Volledig op maat</span>
                  </div>
                  <p className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted mb-2">
                    Waybetter Custom
                  </p>
                  <div className="font-[family-name:var(--font-lexend)] text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-1">
                    vanaf &#8364;499
                  </div>
                  <p className="text-text-muted text-sm mb-1">
                    per maand
                  </p>
                  <p className="text-white/35 text-xs leading-relaxed mb-8">
                    Setup-fee in overleg. Maandelijks opzegbaar.
                  </p>
                  <ul className="border-t border-white/[0.06] pt-6 space-y-3 mb-8">
                    {[
                      'Alles van Waybetter Start',
                      'Open vraagbaak in jullie tone of voice',
                      'Bureau-eigen documenttypes',
                      'Koppelingen met jullie eigen tools en software',
                      'Slim geheugen per klant en project',
                      'Werkt vandaag, groeit met jullie mee',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm text-white/70 leading-snug">
                        <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-white/30 group-hover:bg-orange transition-colors duration-300" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={CTA_HREF}
                    className="h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover animate-pulse-glow hover:shadow-[0_6px_32px_rgba(255,72,0,0.4)] active:scale-[0.98] inline-flex items-center gap-2"
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

      {/* PRIVACY */}
      <ScrollReveal>
        <section className="noise bg-dark border-t border-dark-border">
          <div className="max-w-5xl mx-auto px-6 py-24">
            <div className="reveal mb-12">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-white leading-tight tracking-tight mb-4">
                Privacy is geen bijzaak.
              </h2>
              <p className="text-text-muted text-base md:text-lg leading-relaxed max-w-2xl">
                Bureau-data is gevoelig. Klanten, budgetten, strategie. Daar gaan we zorgvuldig mee om.
              </p>
            </div>
            <div className="reveal grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  Icon: ShieldCheck,
                  title: 'Filtering voordat AI het ziet',
                  body: 'Persoonsnamen, contactgegevens en bedragen worden gefilterd voordat AI ze leest. Het AI model krijgt genoeg context om bruikbaar te werken, niet meer dan nodig.',
                },
                {
                  Icon: CheckCircle,
                  title: 'AVG-compliant',
                  body: 'Verwerkersovereenkomst beschikbaar. Data binnen Europa. Geen training op jullie data.',
                },
                {
                  Icon: Lock,
                  title: 'Extra zekerheid mogelijk',
                  body: 'Voor bureaus die met extra gevoelige data werken zijn er extra lagen mogelijk. Bespreken we in een gesprek.',
                },
              ].map(({ Icon, title, body }) => (
                <div key={title} className="border border-dark-border rounded-xl p-6 bg-dark-card hover:border-orange/40 transition-colors duration-200">
                  <Icon className="w-7 h-7 text-orange mb-8 shrink-0" strokeWidth={1.5} />
                  <h3 className="font-[family-name:var(--font-lexend)] text-sm font-bold text-white mb-2 leading-snug">{title}</h3>
                  <p className="text-text-muted text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* VOOR ELK TYPE BUREAU */}
      <ScrollReveal>
        <section className="bg-warm border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-24">

            <div className="reveal mb-10">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(28px,4vw,48px)] font-extrabold text-text leading-tight tracking-tight mb-4">
                Voor elk type bureau.
              </h2>
              <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-2xl">
                Reclame, branding, productie, PR, activatie, design. Werk beter met Waybetter.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  title: 'Reclame- en brandingbureaus',
                  body: 'Van klantgesprek naar campagne-evaluatie.',
                  quote: 'Een uur klantgesprek wordt binnen &#233;&#233;n minuut een nette samenvatting plus actiepunten.',
                },
                {
                  title: 'Activatie- en eventbureaus',
                  body: 'Van meeting naar briefing zonder handmatig uitwerken.',
                  quote: 'Een PM vraagt: tien locaties in Noord-Holland in juni. Waybetter haalt ze op uit jullie eigen database.',
                },
                {
                  title: 'PR- en communicatiebureaus',
                  body: 'Persberichten, debriefs en klantrapportages.',
                  quote: 'Een persbericht op basis van de eerste klantmail.',
                },
                {
                  title: 'Productiebureaus',
                  body: 'Call sheets, backplanningen en leveranciersbriefings.',
                  quote: 'Een nieuwe junior vraagt: welke foodtrucks kunnen we inzetten zonder groot rijbewijs? Waybetter geeft direct antwoord.',
                },
              ].map(({ title, body, quote }, i) => (
                <div
                  key={title}
                  className={`reveal reveal-delay-${i + 1} bg-white border border-border rounded-2xl p-5`}
                >
                  <h3 className="font-[family-name:var(--font-lexend)] text-sm font-bold text-text mb-2 leading-snug">{title}</h3>
                  <p className="text-text-sec text-sm leading-relaxed mb-3">{body}</p>
                  <p
                    className="text-text-muted text-xs leading-relaxed italic border-t border-border pt-3"
                    dangerouslySetInnerHTML={{ __html: quote }}
                  />
                </div>
              ))}
            </div>

            <div className="reveal mt-12 text-center">
              <p className="text-text-sec text-base md:text-lg leading-relaxed mb-6">
                Benieuwd wat Waybetter voor jullie bureau kan betekenen?
              </p>
              <a
                href={CTA_HREF}
                className="h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover animate-pulse-glow hover:shadow-[0_6px_32px_rgba(255,72,0,0.4)] active:scale-[0.98] inline-flex items-center gap-2.5"
              >
                Plan een gesprek
                <span className="arrow-icon inline-block">&#8594;</span>
              </a>
            </div>

          </div>
        </section>
      </ScrollReveal>

      {/* BEWIJS */}
      <ScrollReveal>
        <section className="noise bg-dark border-t border-dark-border">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <div className="reveal mb-12 text-center">
              <h2 className="font-[family-name:var(--font-lexend)] text-[clamp(20px,2.5vw,28px)] font-bold text-white leading-tight tracking-tight">
                Bureaus die met Waybetter werken.
              </h2>
            </div>
            <div className="reveal flex flex-col sm:flex-row items-center justify-center gap-12 md:gap-20">
              {/* Chase Amsterdam */}
              <div className="flex items-center justify-center opacity-30 hover:opacity-70 transition-all duration-300">
                <div className="h-8 flex items-center">
                  <span className="font-[family-name:var(--font-lexend)] text-sm font-bold tracking-[0.12em] uppercase text-white">
                    Chase Amsterdam
                  </span>
                </div>
              </div>
              {/* All Day Productions */}
              <div className="flex items-center justify-center opacity-30 hover:opacity-70 transition-all duration-300">
                <div className="h-8 flex items-center">
                  <span className="font-[family-name:var(--font-lexend)] text-sm font-bold tracking-[0.12em] uppercase text-white">
                    All Day Productions
                  </span>
                </div>
              </div>
              {/* Newfound */}
              <div className="flex items-center justify-center opacity-30 hover:opacity-70 transition-all duration-300">
                <div className="h-8 flex items-center">
                  <span className="font-[family-name:var(--font-lexend)] text-sm font-bold tracking-[0.12em] uppercase text-white">
                    Newfound
                  </span>
                </div>
              </div>
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
                Werk beter met Waybetter.
              </h2>
              <p className="text-text-sec text-base md:text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
                We kennen jullie wereld. Waybetter is gemaakt door bureaumensen, voor bureaumensen. We sparren graag over wat jullie nodig hebben.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href={CTA_HREF}
                  className="h-12 px-10 bg-orange text-white rounded-lg text-base font-semibold transition-all hover:bg-orange-hover animate-pulse-glow hover:shadow-[0_6px_32px_rgba(255,72,0,0.4)] active:scale-[0.98] inline-flex items-center gap-2.5"
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
