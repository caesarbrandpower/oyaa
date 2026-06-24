// app/evaluatie/[id]/page.jsx
// Publieke evaluatie-preview pagina — geen auth vereist.
import { createServiceClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';

async function getEvalData(threadId) {
  const supabase = createServiceClient();
  const { data: thread } = await supabase
    .from('threads')
    .select('field_briefing_extras')
    .eq('id', threadId)
    .single();

  if (!thread?.field_briefing_extras) return null;

  const entries = Object.values(thread.field_briefing_extras);
  return entries.find((v) => v?.campagne) ?? null;
}

export default async function EvaluatiePage({ params }) {
  const { id } = await params;
  const d = await getEvalData(id);
  if (!d) notFound();

  const totaalSamples   = d.dagen?.reduce((s, dag) => s + (dag.samples   || 0), 0) ?? d.totaal_samples   ?? 0;
  const totaalBezoekers = d.dagen?.reduce((s, dag) => s + (dag.bezoekers || 0), 0) ?? d.totaal_bezoekers ?? 0;
  const target          = d.target ?? 0;
  const delta           = totaalSamples - target;
  const realisatiePct   = target > 0 ? Math.round((totaalSamples / target) * 100) : 0;

  const C = {
    navy:     '#0F1052',
    geel:     '#E9FF31',
    greyblue: '#9BAFBC',
    lichtbg:  '#EDECE9',
    white:    '#FFFFFF',
  };

  const sectionBase = 'rounded-2xl overflow-hidden';

  return (
    <main style={{ background: C.lichtbg, minHeight: '100vh', padding: '2.5rem 1rem', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* SECTIE 1 — Header */}
        <section style={{ background: C.navy, borderRadius: 16, padding: '2rem 2rem 2rem 2.5rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: C.geel }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <p style={{ color: C.greyblue, fontSize: 13, marginBottom: 6 }}>
                {d.klant}{d.datum ? ` · ${d.datum}` : ''}
              </p>
              <h1 style={{ fontFamily: 'Tungsten Bold, Arial, sans-serif', color: C.white, fontSize: 42, fontWeight: 'bold', lineHeight: 1.1, margin: 0 }}>
                {d.campagne}
              </h1>
              <div style={{
                marginTop: 16, display: 'inline-block',
                background: C.geel, color: C.navy,
                padding: '4px 14px', borderRadius: 6,
                fontFamily: 'Tungsten Bold, Arial, sans-serif', fontSize: 14, fontWeight: 'bold', letterSpacing: 1,
              }}>
                Campagne evaluatie
              </div>
            </div>
            <img src="/chase_logo_diap.png" alt="Chase" style={{ height: 36, opacity: 0.85, flexShrink: 0, marginTop: 4 }} />
          </div>
          <p style={{ color: C.greyblue, fontSize: 12, marginTop: 12, marginBottom: 0 }}>
            {[d.dagen?.length && `${d.dagen.length} dagen`, d.locaties?.length && `${d.locaties.length} locaties`, d.periode]
              .filter(Boolean).join('  ·  ')}
          </p>
        </section>

        {/* SECTIE 2 — Kernresultaten */}
        <section style={{ background: C.white, borderRadius: 16, padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontFamily: 'Tungsten Bold, Arial, sans-serif', color: C.navy, fontSize: 26, margin: 0 }}>Kernresultaten</h2>
            <img src="/chase_logo_main.png" alt="" style={{ height: 26, opacity: 0.4 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              { label: 'Target',       value: target.toLocaleString('nl-NL'),          sub: 'samples',         highlight: false },
              { label: 'Gerealiseerd', value: totaalSamples.toLocaleString('nl-NL'),   sub: 'samples',         highlight: true  },
              { label: 'Realisatie',   value: `${realisatiePct}%`,                     sub: `${delta >= 0 ? '+' : ''}${delta.toLocaleString('nl-NL')} vs target`, highlight: false },
              { label: 'Bezoekers',    value: totaalBezoekers.toLocaleString('nl-NL'), sub: 'totaal bereik',   highlight: false },
            ].map((card) => (
              <div key={card.label} style={{
                background: card.highlight ? C.navy : C.white,
                border: card.highlight ? 'none' : '1px solid #DDDDDD',
                borderRadius: 12, padding: '1rem', textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <p style={{ fontFamily: 'Tungsten Book, Arial, sans-serif', color: card.highlight ? C.geel : C.greyblue, fontSize: 13, fontWeight: 600, margin: '0 0 6px' }}>
                  {card.label}
                </p>
                <p style={{ fontFamily: 'Tungsten Book, Arial, sans-serif', color: card.highlight ? C.white : C.navy, fontSize: 36, fontWeight: 'bold', margin: '0 0 4px', lineHeight: 1 }}>
                  {card.value}
                </p>
                <p style={{ color: C.greyblue, fontSize: 11, margin: 0 }}>{card.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTIE 3 — Aantallen per dag */}
        {d.dagen?.length > 0 && (
          <section style={{ background: C.white, borderRadius: 16, padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'Tungsten Bold, Arial, sans-serif', color: C.navy, fontSize: 26, margin: 0 }}>Aantallen per dag</h2>
              <img src="/chase_logo_main.png" alt="" style={{ height: 26, opacity: 0.4 }} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.navy, color: C.white }}>
                  <th style={{ textAlign: 'left',   padding: '10px 12px', borderRadius: '8px 0 0 0', fontFamily: 'Tungsten Book, Arial, sans-serif', fontWeight: 600 }}>Dag</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px',                             fontFamily: 'Tungsten Book, Arial, sans-serif', fontWeight: 600 }}>Samples</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', borderRadius: '0 8px 0 0', fontFamily: 'Tungsten Book, Arial, sans-serif', fontWeight: 600 }}>Bezoekers</th>
                </tr>
              </thead>
              <tbody>
                {d.dagen.map((dag, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#F5F5F5' : C.white }}>
                    <td style={{ padding: '9px 12px' }}>{dag.dag}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>{dag.samples?.toLocaleString('nl-NL') ?? '-'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>{dag.bezoekers?.toLocaleString('nl-NL') ?? '-'}</td>
                  </tr>
                ))}
                <tr style={{ background: C.lichtbg, fontWeight: 700 }}>
                  <td style={{ padding: '9px 12px', fontFamily: 'Tungsten Book, Arial, sans-serif', fontWeight: 700 }}>Totaal</td>
                  <td style={{ padding: '9px 12px', textAlign: 'center', fontFamily: 'Tungsten Book, Arial, sans-serif', fontWeight: 700 }}>{totaalSamples.toLocaleString('nl-NL')}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'center', fontFamily: 'Tungsten Book, Arial, sans-serif', fontWeight: 700 }}>{totaalBezoekers.toLocaleString('nl-NL')}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* SECTIE 4 — Resultaten per locatie */}
        {d.locaties?.length > 0 && (
          <section style={{ background: C.lichtbg, borderRadius: 16, padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'Tungsten Bold, Arial, sans-serif', color: C.navy, fontSize: 26, margin: 0 }}>Resultaten per locatie</h2>
              <img src="/chase_logo_main.png" alt="" style={{ height: 26, opacity: 0.4 }} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.navy, color: C.white }}>
                  {['Locatie', 'Doel', 'Realisatie', 'Contacten', '%'].map((h, i, arr) => (
                    <th key={h} style={{
                      textAlign: i === 0 ? 'left' : 'center',
                      padding: '10px 12px',
                      borderRadius: i === 0 ? '8px 0 0 0' : i === arr.length - 1 ? '0 8px 0 0' : 0,
                      fontFamily: 'Tungsten Book, Arial, sans-serif', fontWeight: 600,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.locaties.map((loc, i) => {
                  const pct = loc.doel > 0 ? Math.round((loc.gerealiseerd / loc.doel) * 100) : 0;
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#F0F0EE' : C.white }}>
                      <td style={{ padding: '9px 12px' }}>{loc.naam}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>{loc.doel?.toLocaleString('nl-NL') ?? '-'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>{loc.gerealiseerd?.toLocaleString('nl-NL') ?? '-'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>{loc.contacten?.toLocaleString('nl-NL') ?? '-'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: pct >= 100 ? '#16a34a' : C.navy }}>
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* SECTIE 5 — Verloop van de actie */}
        {d.verloop?.length > 0 && (
          <section style={{ background: C.white, borderRadius: 16, padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'Tungsten Bold, Arial, sans-serif', color: C.navy, fontSize: 26, margin: 0 }}>Verloop van de actie</h2>
              <img src="/chase_logo_main.png" alt="" style={{ height: 26, opacity: 0.4 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {d.verloop.map((item, i) => (
                <div key={i} style={{ background: C.lichtbg, borderRadius: 10, padding: '1rem', border: '0.5px solid #DDDDDD' }}>
                  <p style={{ fontFamily: 'Tungsten Book, Arial, sans-serif', color: C.navy, fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>
                    {item.label}
                  </p>
                  <p style={{ color: '#555555', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{item.tekst}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTIE 6 — Terugblik */}
        {(d.goedGegaan?.length > 0 || d.verbeterpunten?.length > 0) && (
          <section style={{ borderRadius: 16, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ background: C.navy, padding: '1.5rem' }}>
              <h3 style={{ fontFamily: 'Tungsten Book, Arial, sans-serif', color: C.geel, fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>
                Wat ging goed
              </h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {d.goedGegaan?.map((item, i) => (
                  <li key={i} style={{ color: C.white, fontSize: 13, display: 'flex', gap: 8, lineHeight: 1.5 }}>
                    <span style={{ color: C.geel, fontWeight: 700, flexShrink: 0 }}>›</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ background: C.white, padding: '1.5rem' }}>
              <h3 style={{ fontFamily: 'Tungsten Book, Arial, sans-serif', color: C.navy, fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>
                Wat kan beter
              </h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {d.verbeterpunten?.map((item, i) => (
                  <li key={i} style={{ color: C.navy, fontSize: 13, display: 'flex', gap: 8, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>›</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* SECTIE 7 — Actiepunten */}
        {d.actiepunten?.length > 0 && (
          <section style={{ background: C.white, borderRadius: 16, padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'Tungsten Bold, Arial, sans-serif', color: C.navy, fontSize: 26, margin: 0 }}>Actiepunten</h2>
              <img src="/chase_logo_main.png" alt="" style={{ height: 26, opacity: 0.4 }} />
            </div>
            <p style={{ fontFamily: 'Tungsten Book, Arial, sans-serif', color: C.greyblue, fontSize: 14, margin: '0 0 12px' }}>
              Volgende editie
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {d.actiepunten.map((actie, i) => (
                <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', background: '#F5F5F5', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: C.geel,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontFamily: 'Tungsten Bold, Arial, sans-serif',
                    color: C.navy, fontSize: 14, fontWeight: 'bold',
                  }}>
                    {i + 1}
                  </div>
                  <p style={{ color: C.navy, fontSize: 13, margin: 0, paddingTop: 4, lineHeight: 1.5 }}>{actie}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer style={{ textAlign: 'center', padding: '1rem 0 0.5rem' }}>
          <p style={{ color: C.greyblue, fontSize: 11, margin: 0 }}>
            Gegenereerd via Waybetter · chase.waybetter.nl
          </p>
        </footer>

      </div>
    </main>
  );
}
