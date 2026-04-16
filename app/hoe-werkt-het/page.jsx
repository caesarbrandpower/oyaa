import Link from 'next/link';

export const metadata = {
  title: 'Hoe werkt Waybetter?',
  description: 'Van aantekening naar briefing. Technische uitleg over hoe Waybetter werkt.',
};

const Section = ({ num, title, children }) => (
  <div className="py-10 border-b border-border last:border-b-0">
    <div className="flex items-baseline gap-4 mb-5">
      <span className="text-[8pt] font-semibold tracking-[0.2em] text-orange uppercase shrink-0">{num}</span>
      <h2 className="font-[family-name:var(--font-lexend)] text-[17px] font-bold text-text tracking-tight">{title}</h2>
    </div>
    {children}
  </div>
);

const Body = ({ children, className = '' }) => (
  <p className={`text-[15px] text-text-sec leading-[1.75] mb-4 last:mb-0 max-w-[580px] ${className}`}>
    {children}
  </p>
);

const BronCard = ({ icon, name, desc }) => (
  <div className="flex gap-3 items-start p-4 rounded-xl border border-border bg-warm">
    <span className="text-[20px] shrink-0 mt-0.5">{icon}</span>
    <div>
      <p className="font-[family-name:var(--font-lexend)] text-[14px] font-semibold text-text mb-0.5">{name}</p>
      <p className="text-[13px] text-text-muted leading-[1.55]">{desc}</p>
    </div>
  </div>
);

const BureauCard = ({ name, use }) => (
  <div className="p-4 rounded-xl border border-border bg-warm">
    <p className="font-[family-name:var(--font-lexend)] text-[13px] font-bold text-text mb-1">{name}</p>
    <p className="text-[13px] text-text-muted leading-[1.5]">{use}</p>
  </div>
);

const RoadmapRow = ({ label, active }) => (
  <div className="flex gap-3 items-start px-4 py-3 border-b border-border last:border-b-0">
    <div
      className="w-1.5 h-1.5 rounded-full shrink-0 mt-[7px]"
      style={{ background: active === 'live' ? '#FF4800' : active === 'soon' ? '#bbb' : '#ddd' }}
    />
    <p className="text-[13.5px] text-text-sec leading-[1.6]" dangerouslySetInnerHTML={{ __html: label }} />
  </div>
);

const DocRow = ({ num, label }) => (
  <div className="flex gap-3 items-center px-4 py-2.5 border-b border-border last:border-b-0">
    <span className="text-[11px] font-semibold text-orange w-5 shrink-0">{num}</span>
    <span className="text-[13.5px] text-text-sec">{label}</span>
  </div>
);

export default function HoeWerktHet() {
  return (
    <div className="min-h-screen bg-warm">
      {/* Header */}
      <header className="bg-dark border-b border-dark-border sticky top-0 z-10">
        <div className="max-w-[860px] mx-auto px-8 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-lexend)] text-[11px] tracking-[0.18em] font-semibold text-orange uppercase">Waybetter</span>
            <span className="text-orange text-[13px]">·</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30 font-[family-name:var(--font-outfit)]">Made for agency people</span>
          </div>
          <Link
            href="/"
            className="text-[12px] text-white/30 hover:text-white/60 transition-colors font-[family-name:var(--font-outfit)]"
          >
            ← Terug
          </Link>
        </div>
      </header>

      <main className="max-w-[720px] mx-auto px-8 pb-20">
        {/* Hero */}
        <div className="pt-14 pb-12 border-b border-border">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-text-muted mb-4 font-[family-name:var(--font-outfit)]">
            Documentatie
          </p>
          <h1 className="font-[family-name:var(--font-lexend)] text-[clamp(32px,6vw,52px)] font-extrabold leading-[1.05] tracking-tight text-text mb-4">
            Hoe werkt<br />
            <span className="text-orange">Waybetter?</span>
          </h1>
          <p className="text-[17px] text-text-sec leading-[1.6] max-w-[480px] font-[family-name:var(--font-outfit)]">
            Van aantekening naar briefing. In seconden.
          </p>
        </div>

        {/* 01 Wat is Waybetter */}
        <Section num="01" title="Wat is Waybetter">
          <Body>
            Waybetter verwerkt je aantekeningen, opgenomen gesprekken en bestanden naar direct bruikbare documenten voor je team of klant. In jouw format, in jouw toon.
          </Body>
          <Body>
            Niet iedereen die maar wat doet met ChatGPT, maar één tool, één werkwijze, voor het hele team.
          </Body>
        </Section>

        {/* 02 Voor welke bureaus */}
        <Section num="02" title="Voor welke bureaus">
          <div className="grid grid-cols-2 gap-2.5 mt-1 max-[560px]:grid-cols-1">
            <BureauCard name="Activatie- & eventbureaus" use="Van meeting naar briefing zonder handmatig uitwerken" />
            <BureauCard name="Productiebureaus" use="Call sheets, backplanningen en leveranciersbriefings in één klik" />
            <BureauCard name="Reclame- & brandingbureaus" use="Van klantgesprek naar campagne-evaluatie" />
            <BureauCard name="PR & communicatiebureaus" use="Persberichten, debriefs en klantrapportages" />
          </div>
        </Section>

        {/* 03 Welke documenten */}
        <Section num="03" title="Welke documenten maakt Waybetter">
          <Body>
            Alle documenten worden custom gebouwd tijdens onboarding — in jullie format, jullie tone of voice, jullie manier van werken. Elk bureau krijgt zijn eigen subdomein en formats.
          </Body>
          <div className="rounded-xl border border-border overflow-hidden mt-2">
            <DocRow num="01" label="Meeting samenvatting + actiepunten" />
            <DocRow num="02" label="Briefing account naar PM" />
            <DocRow num="03" label="Projectbriefing operatie" />
            <DocRow num="04" label="Design briefing" />
            <DocRow num="05" label="Campagne-evaluatie" />
            <DocRow num="06" label="Call sheet" />
            <DocRow num="07" label="Leveranciersbriefing" />
            <DocRow num="08" label="Klantdebrief" />
            <div className="flex gap-3 items-center px-4 py-2.5">
              <span className="text-[11px] font-semibold text-orange w-5 shrink-0">+</span>
              <span className="text-[13.5px] text-text-muted italic">En alles wat jouw bureau specifiek nodig heeft</span>
            </div>
          </div>
        </Section>

        {/* 04 Welke bronnen */}
        <Section num="04" title="Welke bronnen gebruiken we">
          <div className="flex flex-col gap-2.5 mt-1">
            <BronCard icon="🎙" name="Voice Recording" desc="Directe opname in de browser, geen externe apps nodig." />
            <BronCard icon="📝" name="Transcript Processing" desc="Automatische omzetting van spraak naar tekst via OpenAI Whisper." />
            <BronCard icon="🤖" name="Custom AI Models" desc="Claude Sonnet voor documentgeneratie, getraind op jullie formats." />
            <BronCard icon="🔒" name="Privacy Layer" desc="Namen en gevoelige data gefilterd voordat AI-verwerking plaatsvindt." />
          </div>
        </Section>

        {/* 05 V1 */}
        <Section num="05" title="V1 — Nu live">
          <div className="rounded-xl border border-border overflow-hidden mt-1">
            <RoadmapRow active="live" label="<strong>Custom documentgenerator</strong> — input verwerken naar gestructureerde documenten in jullie format" />
            <RoadmapRow active="live" label="<strong>Voice recording</strong> — opname direct in browser, geen externe tools" />
            <RoadmapRow active="live" label="<strong>Transcript processing</strong> — automatische spraak-naar-tekst conversie" />
            <RoadmapRow active="live" label="<strong>Privacy filtering</strong> — anonimisering van gevoelige informatie" />
            <RoadmapRow active="live" label="<strong>Subdomein per bureau</strong> — chase.waybetter.nl, allday.waybetter.nl" />
          </div>
        </Section>

        {/* 06 V2 */}
        <Section num="06" title="V2 — Mei-Juni 2026">
          <div className="rounded-xl border border-border overflow-hidden mt-1">
            <RoadmapRow active="soon" label="<strong>Bureau-cockpit</strong> — projectstructuur per klant, geheugen dat werkwijze leert" />
            <RoadmapRow active="soon" label="<strong>Tone of voice per klant</strong> — verschillende schrijfstijlen per project" />
            <RoadmapRow active="soon" label="<strong>Gmail/Outlook OAuth</strong> — e-mails als directe input" />
            <RoadmapRow active="soon" label="<strong>Format library</strong> — upload jullie bestaande templates" />
          </div>
        </Section>

        {/* 07 V3 */}
        <Section num="07" title="V3 — Q3 2026">
          <div className="rounded-xl border border-border overflow-hidden mt-1">
            <RoadmapRow active="future" label="<strong>Live meeting-bots</strong> — automatische transcriptie van Zoom, Google Meet, Teams via Recall.ai" />
            <RoadmapRow active="future" label="<strong>Smart koppelingen</strong> — Slack threads samenvatten, SharePoint documenten verwerken" />
            <RoadmapRow active="future" label="<strong>Automatische workflows</strong> — documenten genereren op vaste momenten" />
            <RoadmapRow active="future" label="<strong>Kennisbank</strong> — systeem leert van elk document en wordt slimmer" />
          </div>
        </Section>

        {/* 08 Privacy */}
        <Section num="08" title="Privacy & Veiligheid">
          <Body>
            Automatische filtering — namen, merknamen en budgetten worden vervangen voordat tekst het AI-model bereikt.
          </Body>
          <div className="rounded-xl border border-border overflow-hidden mt-3">
            <div className="grid grid-cols-[80px_1fr] border-b border-border">
              <div className="p-4 text-[11px] font-semibold tracking-[0.08em] uppercase text-text-muted border-r border-border flex items-center">
                Jouw input
              </div>
              <div className="p-4 text-[13.5px] text-text-sec leading-[1.65]">
                Volgende week presenteren we aan{' '}
                <mark className="bg-orange-light text-orange rounded px-1 not-italic">Erik</mark>{' '}
                van{' '}
                <mark className="bg-orange-light text-orange rounded px-1">Coca-Cola</mark>
                . Budget is{' '}
                <mark className="bg-orange-light text-orange rounded px-1">€180.000</mark>.
              </div>
            </div>
            <div className="grid grid-cols-[80px_1fr]">
              <div className="p-4 text-[11px] font-semibold tracking-[0.08em] uppercase text-text-muted border-r border-border flex items-center">
                Naar AI
              </div>
              <div className="p-4 text-[13.5px] text-text-sec leading-[1.65]">
                Volgende week presenteren we aan{' '}
                <span className="bg-green-50 text-green-700 rounded px-1 font-mono text-[12px]">[PERSOON_1]</span>{' '}
                van{' '}
                <span className="bg-green-50 text-green-700 rounded px-1 font-mono text-[12px]">[BEDRIJF_1]</span>
                . Budget is{' '}
                <span className="bg-green-50 text-green-700 rounded px-1 font-mono text-[12px]">[BEDRAG_1]</span>.
              </div>
            </div>
          </div>
          <p className="text-[12px] text-text-muted mt-3">
            Het AI-model ziet jouw gevoelige informatie nooit. DPA beschikbaar, AVG-compliant.
          </p>
        </Section>

        {/* 09 Waarom anders */}
        <Section num="09" title="Waarom Waybetter anders is">
          <div className="rounded-xl bg-dark p-6 mt-1">
            <p className="text-[15px] text-white/60 leading-[1.75] mb-3">
              Andere tools zijn generieke AI-assistenten. Waybetter is een{' '}
              <strong className="text-white font-medium">bureau-specifieke documentmachine</strong>{' '}
              die precies weet hoe jouw bureau werkt.
            </p>
            <p className="text-[15px] text-white/60 leading-[1.75] mb-3">
              Elk document wordt gebouwd op jullie manier. Geen templates, geen standaardformats.{' '}
              <strong className="text-white font-medium">Alles custom.</strong>
            </p>
            <p className="text-[13px] text-white/25">Van aantekening naar briefing. In seconden.</p>
          </div>
        </Section>

        {/* Contact */}
        <div className="pt-8 pb-2">
          <p className="text-[14px] text-text-muted">
            Vragen?{' '}
            <a
              href="mailto:hello@newfound.agency"
              className="text-orange hover:underline"
            >
              hello@newfound.agency
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-dark text-white/35 py-8 text-[13px] font-[family-name:var(--font-outfit)] border-t border-dark-border">
        <div className="max-w-[860px] mx-auto px-8 flex justify-between items-center gap-4 flex-wrap">
          <span>
            <strong className="text-white/55 font-medium">Waybetter</strong>{' '}
            — gemaakt door{' '}
            <a
              href="https://newfound.agency"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/55 hover:text-orange transition-colors no-underline"
            >
              Newfound
            </a>
          </span>
          <Link href="/privacy" className="text-white/30 no-underline hover:text-white/55 transition-colors">
            Privacy & data
          </Link>
        </div>
      </footer>
    </div>
  );
}
