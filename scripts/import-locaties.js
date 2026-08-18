// scripts/import-locaties.js
// Gebruik: node scripts/import-locaties.js           (dry-run, toont wat er zou gebeuren)
//          node scripts/import-locaties.js --write   (voert de import uit)

'use strict';

const { createClient } = require('@supabase/supabase-js');
const { readFileSync, existsSync } = require('fs');
const { parse } = require('csv-parse/sync');
const path = require('path');

const WRITE_MODE = process.argv.includes('--write');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID    = process.env.CHASE_TENANT_ID;

// ─── Env-vars valideren ───────────────────────────────────────────────────────

if (!SUPABASE_URL || !SERVICE_KEY || !TENANT_ID) {
  console.error('Vereist: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CHASE_TENANT_ID');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── CSV inlezen ──────────────────────────────────────────────────────────────

const csvPath = path.join(__dirname, 'chase_locaties_schoon.csv');

if (!existsSync(csvPath)) {
  console.error(`CSV-bestand niet gevonden: ${csvPath}`);
  console.error('Zet chase_locaties_schoon.csv neer in de scripts/ map en probeer opnieuw.');
  process.exit(1);
}

const raw = readFileSync(csvPath, 'utf-8');
const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });

console.log(`${records.length} records gevonden in CSV.\n`);

// ─── Mapping CSV-rij naar DB-record ──────────────────────────────────────────

function mapRecord(r) {
  let bijzonderheden = r.bijzonderheden?.trim() || null;
  if (r.plattegrond_ref?.trim()) {
    const suffix = `Plattegrond: ${r.plattegrond_ref.trim()}`;
    bijzonderheden = bijzonderheden ? `${bijzonderheden}\n${suffix}` : suffix;
  }

  const prijsRaw = r.prijs ? parseFloat(r.prijs.replace(/[^\d,.-]/g, '').replace(',', '.')) : null;
  const prijs = prijsRaw !== null && !isNaN(prijsRaw) ? prijsRaw : null;

  const bereikRaw = r.bereik ? Math.round(parseFloat(r.bereik)) : null;
  const bereik = bereikRaw !== null && !isNaN(bereikRaw) ? bereikRaw : null;

  const geldPrijssoort = ['huurprijs', 'vergunningskosten'];
  const prijssoortNorm = r.prijssoort?.trim().toLowerCase() ?? '';
  const prijssoort = geldPrijssoort.includes(prijssoortNorm) ? prijssoortNorm : null;

  return {
    tenant_id:    TENANT_ID,
    naam:         r.naam.trim(),
    channel:      r.locatietype?.trim() || null,
    adres:        r.adres?.trim() || null,
    prijs,
    prijssoort,
    bereik,
    bereik_note:  r.bereik_note?.trim() || null,
    bijzonderheden,
    telefoon:     r.contact_telefoon?.trim() || null,
    status:       'onbekend',
    bron:         'Ninox-import augustus 2026',
  };
}

// ─── Hoofd-async functie ──────────────────────────────────────────────────────

async function main() {
  // Bestaande locaties ophalen voor deze tenant
  const { data: bestaand, error: fetchErr } = await supabase
    .from('locations')
    .select('id, naam, status, bron')
    .eq('tenant_id', TENANT_ID);

  if (fetchErr) {
    console.error('Ophalen bestaande locaties mislukt:', fetchErr.message);
    process.exit(1);
  }

  const bestaandMap = new Map(bestaand.map(l => [l.naam.toLowerCase(), l]));
  console.log(`${bestaand.length} bestaande locaties gevonden in de database.\n`);

  let inserted = 0, updated = 0, skipped = 0, errors = 0;

  for (const r of records) {
    const mapped = mapRecord(r);
    const key = mapped.naam.toLowerCase();
    const bestaandeLoc = bestaandMap.get(key);

    if (bestaandeLoc) {
      // UPDATE: status en bron NIET overschrijven als ze al op iets anders dan 'onbekend' staan
      const updatePayload = { ...mapped, updated_at: new Date().toISOString() };
      if (bestaandeLoc.status && bestaandeLoc.status !== 'onbekend') {
        delete updatePayload.status;
      }
      if (bestaandeLoc.bron && bestaandeLoc.bron !== 'Ninox-import augustus 2026') {
        delete updatePayload.bron;
      }

      console.log(`BESTAAND  "${mapped.naam}" — zou worden bijgewerkt`);

      if (WRITE_MODE) {
        const { error } = await supabase
          .from('locations')
          .update(updatePayload)
          .eq('id', bestaandeLoc.id);
        if (error) {
          console.error(`  FOUT: ${error.message}`);
          errors++;
        } else {
          console.log('  BIJGEWERKT');
          updated++;
        }
      } else {
        updated++;
      }
    } else {
      console.log(`NIEUW     "${mapped.naam}"`);

      if (WRITE_MODE) {
        const { error } = await supabase
          .from('locations')
          .insert(mapped);
        if (error) {
          console.error(`  FOUT: ${error.message}`);
          errors++;
        } else {
          console.log('  INGEVOEGD');
          inserted++;
        }
      } else {
        inserted++;
      }
    }
  }

  console.log(`\n${WRITE_MODE ? 'Resultaat' : 'Dry-run resultaat'}:`);
  console.log(`  Te invoegen:    ${inserted}`);
  console.log(`  Bij te werken:  ${updated}`);
  console.log(`  Overgeslagen:   ${skipped}`);
  if (errors > 0) console.log(`  Fouten:         ${errors}`);
  if (!WRITE_MODE) console.log('\nVoeg --write toe om de import daadwerkelijk uit te voeren.');
}

main().catch(err => {
  console.error('Onverwachte fout:', err.message);
  process.exit(1);
});
