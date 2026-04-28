import nextDynamic from 'next/dynamic'
import Footer from '@/components/Footer'
import AuthNav from '@/components/AuthNav'
import TenantBadge from '@/components/TenantBadge'

const PublicTranscriptForm = nextDynamic(
  () => import('@/components/PublicTranscriptForm'),
  { loading: () => <div className="bg-dark min-h-[400px]" /> }
)

const AllDayTranscriptForm = nextDynamic(
  () => import('@/components/AllDayTranscriptForm'),
  { loading: () => <div className="bg-dark min-h-[400px]" /> }
)

const DEWOLVEN_CLIENTS = ['Algemeen', 'Woonbond', 'Patagonia', 'bol', 'Museumnacht Amsterdam', 'Heineken Prizes']

const DEWOLVEN_OUTPUT_TYPES = [
  { key: 'allday-samenvatting', label: 'Samenvatting', desc: 'De kern van het gesprek,\ndirect helder.' },
  { key: 'allday-briefing', label: 'Briefing', desc: 'Een heldere opdracht om mee aan de slag te gaan.' },
  { key: 'allday-debrief', label: 'Debrief', desc: 'Een nette terugkoppeling met afspraken en actiepunten.' },
]

const DEWOLVEN_EXTRA_TYPES = [
  { key: 'dewolven-persbericht', label: 'Persbericht-aanzet', desc: 'Een eerste versie van een persbericht op basis van briefing of interview.' },
  { key: 'dewolven-artikel', label: 'Interview \u2192 artikel', desc: 'Van opgenomen interview naar artikel met opbouw en kernpunten.' },
  { key: 'dewolven-campagnerapportage', label: 'Campagnerapportage', desc: 'Resultaten en lessen na een campagne, in heldere structuur.' },
  { key: 'dewolven-vertaling', label: 'Vertaling NL \u2192 EN', desc: 'Van Nederlandse tekst naar Engelse versie, in jullie toon.' },
]

export default function TryToolPage({ tenant }) {
  const isAllDay = tenant?.hostname === 'allday.waybetter.nl'
  const isDeWolven = tenant?.hostname === 'dewolven.waybetter.nl'

  return (
    <>
      <TenantBadge tenant={tenant}>
        {(isAllDay || isDeWolven) && <AuthNav inline />}
      </TenantBadge>

      {/* Hero */}
      <section className="relative bg-dark overflow-hidden">
        {!isAllDay && !isDeWolven && <AuthNav />}

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] rounded-full bg-orange/[0.05] blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[15%] w-[400px] h-[400px] rounded-full bg-orange/[0.03] blur-[100px]" />
        </div>

        <div className="relative max-w-[900px] mx-auto px-8 pt-[100px] pb-16 max-[640px]:pt-[72px] max-[640px]:pb-12">
          {!isAllDay && !isDeWolven && (
            <div className="animate-hero-1">
              <div className="inline-flex items-center gap-2.5 mb-8">
                <span className="font-[family-name:var(--font-lexend)] text-[11px] tracking-[0.2em] font-semibold text-orange uppercase">Waybetter</span>
                <span className="text-orange text-[14px]">&middot;</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange font-[family-name:var(--font-outfit)]">Made for agency people</span>
              </div>
            </div>
          )}

          {isDeWolven ? (
            <h1 className="animate-hero-2 font-[family-name:var(--font-lexend)] text-[clamp(36px,6.5vw,68px)] font-extrabold leading-[1.06] tracking-[-0.025em] text-white mb-7">
              Van interview
              <br />
              naar artikel.
              <br />
              <span className="text-orange">In seconden.</span>
            </h1>
          ) : (
            <h1 className="animate-hero-2 font-[family-name:var(--font-lexend)] text-[clamp(36px,6.5vw,68px)] font-extrabold leading-[1.06] tracking-[-0.025em] text-white mb-7">
              Van aantekening{'\u00A0'}
              <br className="max-[640px]:hidden" />
              naar briefing.
              <br />
              <span className="text-orange">In seconden.</span>
            </h1>
          )}

          {(isAllDay || isDeWolven) ? (
            <p className="animate-hero-3 text-[17px] text-white/50 leading-[1.65] max-w-[560px] font-[family-name:var(--font-outfit)]">
              Zet gesprekken, aantekeningen en opnames om in bruikbare documenten. Voor je team, je klant, of je leverancier.
            </p>
          ) : (
            <p className="animate-hero-3 text-[17px] text-white/50 leading-[1.65] max-w-[540px] font-[family-name:var(--font-outfit)]">
              Waybetter verwerkt je aantekeningen, opgenomen gesprekken en bestanden naar direct bruikbare documenten voor je team of klant. In jouw format, in jouw toon.
            </p>
          )}
        </div>
      </section>

      {isAllDay ? (
        <AllDayTranscriptForm logoUrl={tenant?.logo_url || null} />
      ) : isDeWolven ? (
        <AllDayTranscriptForm
          logoUrl={tenant?.logo_url || null}
          clients={DEWOLVEN_CLIENTS}
          outputTypes={DEWOLVEN_OUTPUT_TYPES}
          extraOutputTypes={DEWOLVEN_EXTRA_TYPES}
        />
      ) : (
        <PublicTranscriptForm logoUrl={tenant?.logo_url || null} />
      )}

      <Footer />
    </>
  )
}
