import { describe, it, expect } from 'vitest';
import { filterHallucinations } from '../whisper';

describe('filterHallucinations', () => {
  it('filtert Amara-ondertitels weg', () => {
    const input = 'Dag allemaal\nOndertiteld door de Amara.org-gemeenschap\nWelkom';
    expect(filterHallucinations(input)).toBe('Dag allemaal\nWelkom');
  });

  it('filtert herhaalde opeenvolgende regels weg', () => {
    const input = 'Hallo\nHallo\nWereld';
    expect(filterHallucinations(input)).toBe('Hallo\nWereld');
  });

  it('geeft lege string terug bij lege input', () => {
    expect(filterHallucinations('')).toBe('');
  });

  it('geeft null terug als input null is', () => {
    expect(filterHallucinations(null)).toBeNull();
  });

  it('laat normale tekst ongemoeid', () => {
    const input = 'Dit is een normaal gesprek.\nDe klant wil een nieuwe campagne.';
    expect(filterHallucinations(input)).toBe(input);
  });

  it('filtert NOS-journaal hallucination weg', () => {
    const input = 'NOS Journaal\nVandaag in het nieuws';
    expect(filterHallucinations(input)).toBe('Vandaag in het nieuws');
  });

  it('filtert case-insensitief', () => {
    const input = 'THANKS FOR WATCHING\nEchte content';
    expect(filterHallucinations(input)).toBe('Echte content');
  });
});
