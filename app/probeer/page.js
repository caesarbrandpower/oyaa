export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';
import Link from 'next/link';
import Footer from '@/components/Footer';
import AuthNav from '@/components/AuthNav';
import TenantBadge from '@/components/TenantBadge';
import { getTenant } from '@/lib/get-tenant';

const PublicTranscriptForm = nextDynamic(
  () => import('@/components/PublicTranscriptForm'),
  { loading: () => <div className="bg-dark min-h-[400px]" /> }
);

const AllDayTranscriptForm = nextDynamic(
  () => import('@/components/AllDayTranscriptForm'),
  { loading: () => <div className="bg-dark min-h-[400px]" /> }
);

export default async function Home() {
  const tenant = await getTenant();
  const isAllDay = tenant?.hostname === 'allday.waybetter.nl';

  return (
    <>
      {/* Teruglink naar salespagina */}
      <div className="bg-dark border-b border-dark-border">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-text-muted text-xs hover:text-white transition-colors">
            &larr; Terug naar Waybetter
          </Link>
          <span className="text-text-muted text-xs">Probeer de tool</span>
        </div>
      </div>

      <TenantBadge tenant={tenant}>
        {isAllDay && <AuthNav inline />}
      </TenantBadge>

      {/* Hero */}
      <section className="relative bg-dark overflow-hidden">
        {!isAllDay && <AuthNav />}

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] rounded-full bg-orange/[0.05] blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[15%] w-[400px] h-[400px] rounded-full bg-orange/[0.03] blur-[100px]" />
        </div>

        <div className="relative max-w-[900px] mx-auto px-8 pt-[100px] pb-16 max-[640px]:pt-[72px] max-[640px]:pb-12">
          {!isAllDay && (
            <div className="animate-hero-1">
              <div className="inline-flex items-center gap-2.5 mb-8">
                <span className="font-[family-name:var(--font-lexend)] text-[11px] tracking-[0.2em] font-semibold text-orange uppercase">Waybetter</span>
                <span className="text-orange text-[14px]">&middot;</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange font-[family-name:var(--font-outfit)]">Made for agency people</span>
              </div>
            </div>
          )}

          <h1 className="animate-hero-2 font-[family-name:var(--font-lexend)] text-[clamp(36px,6.5vw,68px)] font-extrabold leading-[1.06] tracking-[-0.025em] text-white mb-7">
            Van aantekening{'\u00A0'}
            <br className="max-[640px]:hidden" />
            naar briefing.
            <br />
            <span className="text-orange">In seconden.</span>
          </h1>

          {isAllDay ? (
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

      {isAllDay ? <AllDayTranscriptForm /> : <PublicTranscriptForm />}

      <Footer allday={isAllDay} />
    </>
  );
}
