import { describe, it, expect } from 'vitest';
import { hasWriteIntent, CHAT_UPDATABLE_FIELDS } from '../locations-write';

describe('hasWriteIntent', () => {
  it('herkent "zet bij X dat Y"', () => {
    expect(hasWriteIntent('Zet bij Utrecht Centraal dat de laad- en losplek verplaatst is')).toBe(true);
  });

  it('herkent "pas de X aan bij Y"', () => {
    expect(hasWriteIntent('Pas de parkeerinformatie bij Amsterdam Centraal aan')).toBe(true);
  });

  it('herkent "wijzig de X van Y naar Z"', () => {
    expect(hasWriteIntent('Wijzig de status van Rotterdam Centraal naar actief')).toBe(true);
  });

  it('herkent "update X bij Y"', () => {
    expect(hasWriteIntent('Update de bijzonderheden bij Vondelpark')).toBe(true);
  });

  it('herkent geen schrijf-intentie in leesverzoeken', () => {
    expect(hasWriteIntent('Welke stations hebben meer dan 50.000 bereik?')).toBe(false);
    expect(hasWriteIntent('Wat kost Rotterdam Centraal?')).toBe(false);
    expect(hasWriteIntent('Vertel me alles over Utrecht Centraal')).toBe(false);
  });
});

describe('CHAT_UPDATABLE_FIELDS', () => {
  it('bevat bijzonderheden en parkeren', () => {
    expect(CHAT_UPDATABLE_FIELDS).toContain('bijzonderheden');
    expect(CHAT_UPDATABLE_FIELDS).toContain('parkeren');
  });

  it('bevat NIET telefoon, email of website', () => {
    expect(CHAT_UPDATABLE_FIELDS).not.toContain('telefoon');
    expect(CHAT_UPDATABLE_FIELDS).not.toContain('email');
    expect(CHAT_UPDATABLE_FIELDS).not.toContain('website');
  });

  it('bevat NIET naam', () => {
    expect(CHAT_UPDATABLE_FIELDS).not.toContain('naam');
  });
});
