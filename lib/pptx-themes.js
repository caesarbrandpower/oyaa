import path from 'path';

export const THEMES = {
  chase: {
    colors: {
      navy:     '0F1052',
      accent:   'E9FF31',
      greyblue: '9BAFBC',
      lightbg:  'EDECE9',
      white:    'FFFFFF',
      darkgrey: '444444',
    },
    logos: {
      main: path.resolve(process.cwd(), 'public/chase_logo_main.png'),
      diap: path.resolve(process.cwd(), 'public/chase_logo_diap.png'),
    },
    logosWeb: {
      main: '/chase_logo_main.png',
      diap: '/chase_logo_diap.png',
    },
    fonts: {
      bold: 'Tungsten Bold',
      book: 'Tungsten Book',
      body: 'Arial',
    },
    brandName: 'Chase Brand Activation',
  },

  // Coca-Cola — kleuren, logo's en fonts worden ingevuld zodra Chase de assets levert.
  // Tot dan: Chase-waarden als stand-in zodat generatie niet faalt.
  // Te vervangen: colors.navy (primaire kleur), colors.accent, logos.*, fonts.bold/book.
  'coca-cola': {
    colors: {
      navy:     '0F1052',   // TODO: Coca-Cola primaire kleur (rood)
      accent:   'E9FF31',   // TODO: Coca-Cola accent
      greyblue: '9BAFBC',
      lightbg:  'EDECE9',   // TODO: Coca-Cola lichte achtergrond
      white:    'FFFFFF',
      darkgrey: '444444',
    },
    logos: {
      main: path.resolve(process.cwd(), 'public/chase_logo_main.png'),  // TODO: coke_logo_main.png
      diap: path.resolve(process.cwd(), 'public/chase_logo_diap.png'),  // TODO: coke_logo_diap.png
    },
    logosWeb: {
      main: '/chase_logo_main.png',   // TODO: /coke_logo_main.png
      diap: '/chase_logo_diap.png',   // TODO: /coke_logo_diap.png
    },
    fonts: {
      bold: 'Tungsten Bold',   // TODO: Coca-Cola custom font indien van toepassing
      book: 'Tungsten Book',
      body: 'Arial',
    },
    brandName: 'The Coca-Cola Company',
  },
};

/**
 * Zoekt het juiste thema op basis van klantnaam en tenant_config.
 * tenant_config.client_template_map: { themeKey: [alias, alias, ...] }
 * Vergelijking is case-insensitive en getrimd.
 * Valt altijd terug op chase als geen match.
 */
export function getTheme(clientName, tenantConfig) {
  const map = tenantConfig?.client_template_map ?? {};
  const nameLower = (clientName ?? '').toLowerCase().trim();

  if (nameLower) {
    for (const [themeKey, aliases] of Object.entries(map)) {
      if (Array.isArray(aliases) && aliases.some((a) => a.toLowerCase().trim() === nameLower)) {
        return THEMES[themeKey] ?? THEMES.chase;
      }
    }
  }

  return THEMES.chase;
}
