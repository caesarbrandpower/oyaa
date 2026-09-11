import { describe, it, expect } from 'vitest';
import { looksLikeDocument } from '../document-utils';

// Typische evaluatie-output: korte inleiding + JSON-blok.
// looksLikeDocument moet false teruggeven — isEvaluationType bypast die check.
const EVALUATIE_CONTENT = `
Hier is de evaluatie van de campagne voor Chase.

\`\`\`json
{
  "titel": "Chase zomercampagne 2026",
  "opdrachtgever": "Chase Brand Activation",
  "resultaat": "goed",
  "slides": []
}
\`\`\`

Je kunt de PowerPoint downloaden of de online versie bekijken.
`.trim();

describe('looksLikeDocument — evaluatie-content', () => {
  it('herkent evaluatie-output NIET als document (geen headings of bold sections)', () => {
    expect(looksLikeDocument(EVALUATIE_CONTENT)).toBe(false);
  });

  it('herkent een normale briefing WEL als document', () => {
    const briefing = `
## Briefing naar PM

**Opdrachtgever**
Chase Brand Activation — evenementenbureau gespecialiseerd in merkactivaties.

**Doelstelling**
Zomercampagne met focus op jongeren in de leeftijd 18-25. Het doel is merkbekendheid verhogen en directe interactie stimuleren op locatie.

**Deliverables**
Drie contentpakketten en een activatiedag in Amsterdam. Elk pakket bevat social-mediamateriaal, printuitingen en een livemoment.

**Planning**
Week 32: eerste levering concepten ter review. Week 34: activatiedag in het Westerpark, Amsterdam.

## Opmerkingen

Rekening houden met de zomerse planning van de doelgroep. Budgetplafond is vastgesteld op €45.000 exclusief BTW.
    `.trim();
    expect(looksLikeDocument(briefing)).toBe(true);
  });
});

// Foto-veldmapping zoals in DocumentView.jsx:
// extras.foto_voor_url heeft prioriteit, met fallback naar foto_voor, dan null.
function mapFotoVelden(extras) {
  return {
    foto_voor:   extras?.foto_voor_url   ?? extras?.foto_voor   ?? null,
    foto_midden: extras?.foto_midden_url ?? extras?.foto_midden ?? null,
    foto_achter: extras?.foto_achter_url ?? extras?.foto_achter ?? null,
  };
}

describe('evaluatie foto-veldmapping', () => {
  it('gebruikt foto_*_url als die aanwezig is', () => {
    const extras = {
      foto_voor_url: 'https://cdn/voor.jpg',
      foto_midden_url: 'https://cdn/midden.jpg',
      foto_achter_url: 'https://cdn/achter.jpg',
    };
    expect(mapFotoVelden(extras)).toEqual({
      foto_voor: 'https://cdn/voor.jpg',
      foto_midden: 'https://cdn/midden.jpg',
      foto_achter: 'https://cdn/achter.jpg',
    });
  });

  it('valt terug op foto_* als foto_*_url ontbreekt', () => {
    const extras = {
      foto_voor: 'https://cdn/voor-fallback.jpg',
      foto_midden: 'https://cdn/midden-fallback.jpg',
      foto_achter: 'https://cdn/achter-fallback.jpg',
    };
    expect(mapFotoVelden(extras)).toEqual({
      foto_voor: 'https://cdn/voor-fallback.jpg',
      foto_midden: 'https://cdn/midden-fallback.jpg',
      foto_achter: 'https://cdn/achter-fallback.jpg',
    });
  });

  it('geeft null als beide velden ontbreken', () => {
    expect(mapFotoVelden({})).toEqual({
      foto_voor: null,
      foto_midden: null,
      foto_achter: null,
    });
  });

  it('geeft null als extras undefined is', () => {
    expect(mapFotoVelden(undefined)).toEqual({
      foto_voor: null,
      foto_midden: null,
      foto_achter: null,
    });
  });

  it('foto_*_url wint van foto_* als beide aanwezig zijn', () => {
    const extras = {
      foto_voor_url: 'https://cdn/url-versie.jpg',
      foto_voor: 'https://cdn/oude-versie.jpg',
    };
    const result = mapFotoVelden(extras);
    expect(result.foto_voor).toBe('https://cdn/url-versie.jpg');
  });
});
