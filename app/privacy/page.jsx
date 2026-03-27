import Footer from '@/components/Footer';

export const metadata = {
  title: 'Privacy & data — Oyaa.',
};

export default function PrivacyPage() {
  return (
    <>
      <section className="bg-hero py-[88px] pb-16 border-b border-orange-mid">
        <div className="max-w-[800px] mx-auto px-8">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-orange mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange" />
            Privacy &amp; data
          </div>
          <h1 className="font-[family-name:var(--font-lexend)] text-[40px] font-bold leading-[1.15] tracking-tight text-text mb-4">
            Zo gaan we om met jouw klantdata
          </h1>
          <p className="text-lg text-text-sec leading-relaxed max-w-[520px]">
            Helder. Geen kleine lettertjes.
          </p>
        </div>
      </section>

      <div className="max-w-[800px] mx-auto px-8 py-14">
        <a href="/" className="text-sm text-text-muted hover:text-orange transition-colors mb-12 inline-block">
          &larr; Terug naar Oyaa
        </a>

        <p className="text-base text-text leading-[1.7] mb-10">
          Je werkt met gevoelige informatie. Transcripten van klantgesprekken, campagnebriefings,
          strategische plannen. Informatie die je niet zomaar ergens wil laten rondslingeren.
          Hier staat precies wat Oyaa doet — en wat we bewust niet doen.
        </p>

        <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mt-12 mb-5">Wat we doen</h2>

        <h3 className="font-[family-name:var(--font-lexend)] text-[15px] font-semibold text-text mt-7 mb-2">We anonimiseren voor we verwerken</h3>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          Voordat jouw input naar de AI gaat, worden namen, bedrijfsnamen, budgetten en andere
          identificerende informatie vervangen door tijdelijke codes. De AI ziet geen
          &quot;Erik van Vandaag &amp; Morgen&quot; — die ziet &quot;[PERSOON_1] van [BEDRIJF_1]&quot;.
          Na verwerking zetten we alles terug. Jij ziet de volledige output.
          De AI heeft de namen nooit gezien.
        </p>

        <h3 className="font-[family-name:var(--font-lexend)] text-[15px] font-semibold text-text mt-7 mb-2">Die anonimisering gebeurt lokaal, in Europa</h3>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          De stap waarbij we namen herkennen en vervangen, vindt plaats op onze eigen server
          in Duitsland. Identificerende informatie verlaat de EU nooit.
        </p>

        <h3 className="font-[family-name:var(--font-lexend)] text-[15px] font-semibold text-text mt-7 mb-2">We slaan niets op</h3>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          Wat je invoert wordt verwerkt en weggegooid. Geen database, geen logbestanden,
          geen geschiedenis. Zodra je output ziet, bestaat de originele input nergens
          meer in ons systeem.
        </p>

        <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mt-12 mb-5">Wat we niet doen</h2>
        <ul className="space-y-2 mb-4 list-none pl-0">
          <li className="text-[15px] text-text-sec leading-[1.75] pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-text-muted">We gebruiken jouw input niet om AI-modellen te trainen</li>
          <li className="text-[15px] text-text-sec leading-[1.75] pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-text-muted">We verkopen geen data aan derden</li>
          <li className="text-[15px] text-text-sec leading-[1.75] pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-text-muted">We bewaren geen transcripten of documenten</li>
          <li className="text-[15px] text-text-sec leading-[1.75] pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-text-muted">We geven geen toegang aan andere bureaus of partijen</li>
        </ul>

        <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mt-12 mb-5">De AI-laag</h2>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          Oyaa gebruikt de Anthropic API. Via de API wordt content niet gebruikt voor
          modeltraining en niet bewaard na verwerking. Anthropic heeft een
          verwerkersovereenkomst beschikbaar die AVG-compliant is.{' '}
          <a href="https://anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-orange underline underline-offset-[3px] hover:text-orange-hover">
            Lees het privacybeleid van Anthropic &rarr;
          </a>
        </p>

        <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mt-12 mb-5">Vergelijk het met wat je nu gebruikt</h2>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          Slack, Google Workspace, Notion — tools die bureaus dagelijks gebruiken voor
          dezelfde gevoelige informatie — slaan data permanent op in de VS. WeTransfer
          probeerde in 2025 creatief werk te gebruiken voor AI-training, wat leidde tot
          een brede boycot in de creatieve industrie.
        </p>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          Oyaa anonimiseert actief, slaat niets op en gebruikt jouw werk nooit voor
          iets anders dan de output die je vraagt.
        </p>

        <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mt-12 mb-5">Verwerkersovereenkomst</h2>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          Werk je voor klanten waarmee je een NDA hebt getekend? Dan kunnen we een
          verwerkersovereenkomst opstellen die vastlegt hoe Oyaa omgaat met data
          in jouw specifieke context. Mail naar{' '}
          <a href="mailto:privacy@oyaa.app" className="text-orange underline underline-offset-[3px] hover:text-orange-hover">
            privacy@oyaa.app
          </a>
        </p>
      </div>

      <Footer />
    </>
  );
}
