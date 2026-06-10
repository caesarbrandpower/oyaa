import { describe, it, expect } from 'vitest';
import { chunkText } from '../chunk-text';

describe('chunkText', () => {
  it('geeft lege array bij lege input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('geeft korte tekst terug als 1 chunk met index en tokenCount', () => {
    const result = chunkText('Korte alinea.\n\nTweede alinea.');
    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(0);
    expect(result[0].content).toContain('Korte alinea.');
    expect(result[0].tokenCount).toBeGreaterThan(0);
  });

  it('splitst lange tekst in meerdere chunks binnen de limiet', () => {
    const para = 'Dit is een testzin die wat woorden bevat om volume te maken. ';
    const text = Array.from({ length: 40 }, (_, i) => para.repeat(10) + `Alinea ${i}.`).join('\n\n');
    const result = chunkText(text, { maxTokens: 800, overlapTokens: 100 });
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      // max = maxTokens + overlapTokens (overlap-staart plakt voor een nieuwe chunk)
      expect(chunk.content.length).toBeLessThanOrEqual((800 + 100) * 4 + 2);
    }
  });

  it('heeft overlap: het einde van chunk N komt terug aan het begin van chunk N+1', () => {
    const para = 'Herkenbare zin nummer X met voldoende lengte om mee te tellen. ';
    const text = Array.from({ length: 40 }, (_, i) => para.replaceAll('X', String(i)).repeat(8)).join('\n\n');
    const result = chunkText(text, { maxTokens: 800, overlapTokens: 100 });
    expect(result.length).toBeGreaterThan(1);
    const tailOfFirst = result[0].content.slice(-100);
    expect(result[1].content.startsWith(tailOfFirst.slice(-50))).toBe(true);
  });

  it('hakt een alinea die zelf te lang is op zinsgrenzen kapot', () => {
    const oneGiantParagraph = 'Een zin die doorgaat en doorgaat. '.repeat(300);
    const result = chunkText(oneGiantParagraph, { maxTokens: 800, overlapTokens: 100 });
    expect(result.length).toBeGreaterThan(1);
  });
});
