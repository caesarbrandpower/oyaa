import { describe, it, expect } from 'vitest';
import {
  buildLocationIndex,
  detectMentionedLocations,
  formatLocationDetail,
} from '../locations-retrieval';

const LOCATIES = [
  { naam: 'Rotterdam Centraal', stad: 'Rotterdam', channel: 'Treinstation', bereik: 110000, prijs: 2800, prijssoort: 'huurprijs', status: 'actief' },
  { naam: 'Vondelpark', stad: 'Amsterdam', channel: 'Outdoor', bereik: 12000, prijs: 150, prijssoort: 'vergunningskosten', status: 'onbekend' },
  { naam: 'Hoog Catharijne', stad: 'Utrecht', channel: 'Winkelcentrum', bereik: null, prijs: null, prijssoort: null, status: 'onbekend' },
];

describe('buildLocationIndex', () => {
  it('bouwt een koptegel en een rij per locatie', () => {
    const result = buildLocationIndex(LOCATIES);
    expect(result).toContain('naam | stad | channel | bereik/dag | prijs | prijssoort | cpm | status');
    expect(result).toContain('Rotterdam Centraal');
    expect(result).toContain('110.000');
  });

  it('toont streepje voor lege bereik/prijs', () => {
    const result = buildLocationIndex(LOCATIES);
    const hoogCatharijneLijn = result.split('\n').find(l => l.includes('Hoog Catharijne'));
    expect(hoogCatharijneLijn).toContain(' - |');
  });

  it('berekent CPM correct (prijs / bereik * 1000)', () => {
    const result = buildLocationIndex(LOCATIES);
    const rottLijn = result.split('\n').find(l => l.includes('Rotterdam Centraal'));
    // 2800 / 110000 * 1000 = 25.45 => €26
    expect(rottLijn).toContain('€26');
  });

  it('toont geen CPM als bereik of prijs ontbreekt', () => {
    const result = buildLocationIndex(LOCATIES);
    const vondLijn = result.split('\n').find(l => l.includes('Vondelpark'));
    // vergunningskosten tellen niet mee voor CPM (alleen huurprijs)
    expect(vondLijn).not.toMatch(/€\d+/);
  });

  it('retourneert een lege string bij lege invoer', () => {
    expect(buildLocationIndex([])).toBe('');
  });
});

describe('detectMentionedLocations', () => {
  it('vindt een locatie op exacte naam', () => {
    const result = detectMentionedLocations('Wat kost Rotterdam Centraal?', LOCATIES);
    expect(result).toHaveLength(1);
    expect(result[0].naam).toBe('Rotterdam Centraal');
  });

  it('is case-insensitief', () => {
    const result = detectMentionedLocations('vondelpark is goed', LOCATIES);
    expect(result[0].naam).toBe('Vondelpark');
  });

  it('vindt meerdere locaties in een bericht', () => {
    const result = detectMentionedLocations('Vergelijk Rotterdam Centraal en Vondelpark', LOCATIES);
    expect(result).toHaveLength(2);
  });

  it('retourneert leeg als er geen match is', () => {
    expect(detectMentionedLocations('Welke locaties zijn er in Groningen?', LOCATIES)).toHaveLength(0);
  });
});

describe('formatLocationDetail', () => {
  it('bevat alle operationele velden', () => {
    const loc = {
      naam: 'Rotterdam Centraal',
      omschrijving: 'Druk station',
      doelgroep: '18-35',
      adres: 'Stationsplein 1',
      parkeren: 'P+R aanbevolen',
      laden_lossen: 'Ingang B',
      vergunning_status: 'aanwezig',
      vergunning_vervaldatum: '2026-12-31',
      bijzonderheden: 'Minimaal 4 weken vooraf',
      status: 'actief',
      bron: 'Ninox-import augustus 2026',
    };
    const result = formatLocationDetail(loc);
    expect(result).toContain('Rotterdam Centraal');
    expect(result).toContain('Minimaal 4 weken vooraf');
    expect(result).toContain('aanwezig');
    expect(result).toContain('2026-12-31');
  });

  it('slaat telefoon en email altijd over', () => {
    const loc = { naam: 'Test', telefoon: '010-123', email: 'test@test.nl' };
    const result = formatLocationDetail(loc);
    expect(result).not.toContain('010-123');
    expect(result).not.toContain('test@test.nl');
  });

  it('voegt een Ninox-waarschuwing toe bij status onbekend', () => {
    const loc = { naam: 'Test', status: 'onbekend', bron: 'Ninox-import augustus 2026' };
    const result = formatLocationDetail(loc);
    expect(result).toContain('Ninox-import');
  });
});
