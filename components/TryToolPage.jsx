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

export default function TryToolPage({ tenant }) {
  const isAllDay = tenant?.hostname === 'allday.waybetter.nl'
  const greeting = tenant?.name
    ? `Hi, team ${tenant.name}. Wat gaan we vandaag maken?`
    : 'Hi! Wat gaan we vandaag maken?'

  return (
    <>
      <TenantBadge tenant={tenant}>
        {isAllDay && <AuthNav inline />}
      </TenantBadge>

      {/* Hero */}
      <section className="relative bg-dark overflow-hidden min-h-[30vh] flex flex-col justify-center">
        {!isAllDay && <AuthNav />}

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] rounded-full bg-orange/[0.05] blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[15%] w-[400px] h-[400px] rounded-full bg-orange/[0.03] blur-[100px]" />
        </div>

        <div className="relative max-w-[900px] mx-auto px-8 py-10 max-[640px]:py-8">
          <h1 className="animate-hero-2 font-[family-name:var(--font-lexend)] text-[clamp(28px,5vw,56px)] font-extrabold leading-[1.1] tracking-[-0.02em] text-white">
            {greeting}
          </h1>
        </div>
      </section>

      {isAllDay ? <AllDayTranscriptForm logoUrl={tenant?.logo_url || null} /> : <PublicTranscriptForm logoUrl={tenant?.logo_url || null} />}

      <Footer allday={isAllDay} />
    </>
  )
}
