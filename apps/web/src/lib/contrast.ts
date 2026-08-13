/**
 * Ratios de contraste WCAG 2.1, mesurés plutôt qu'affirmés.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi ce module existe.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `docs/design.md` porte des ratios dans son texte — « 5,71:1 sur card »,
 * « 8,71:1 sur primary ». Ce sont des COMMENTAIRES : ils ne protègent de rien.
 * Le jour où un token change de valeur, la phrase reste vraie dans le document
 * et fausse à l'écran, et personne ne s'en aperçoit avant qu'un utilisateur ne
 * signale un texte illisible.
 *
 * Le piège précis que ce module ferme : le document mesure ses paires sur fond
 * CLAIR. Dès qu'un composant est posé sur une surface sombre — bordeaux
 * `#630210`, sidebar `#3A010A` — toutes ces mesures deviennent caduques, et les
 * quatre tokens de statut sont justement des teintes foncées. `destructive`
 * `#B91C1C` sur bordeaux ne fait que 2,10:1.
 *
 * Aucune dépendance : la formule WCAG tient en quinze lignes, et la faire
 * dépendre d'une bibliothèque rendrait le test moins lisible que la règle
 * qu'il vérifie.
 */

/** Seuil AA pour du TEXTE. */
export const AA_TEXT = 4.5;
/** Seuil AA pour du grand texte, et pour tout élément NON textuel : bordure de
 *  champ en erreur, anneau de focus, trait de graphique. */
export const AA_LARGE = 3;

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** `#RGB` ou `#RRGGBB`, casse indifférente. Lève sur toute autre forme : une
 *  couleur mal orthographiée doit faire échouer le test, pas passer en noir. */
export function parseHex(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Couleur hexadécimale invalide : ${hex}`);
  }

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

/** Composante linéarisée, formule WCAG 2.1. */
function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(color: Rgb): number {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/**
 * Ratio entre deux couleurs OPAQUES, de 1 à 21.
 *
 * L'ordre des arguments est indifférent : la formule prend la plus claire au
 * numérateur. Les couleurs à canal alpha ne sont pas acceptées — leur contraste
 * dépend de ce qu'il y a dessous, donc d'un contexte que cette fonction n'a pas.
 */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(parseHex(a));
  const second = relativeLuminance(parseHex(b));
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Arrondi au centième, pour des messages d'échec lisibles. */
export function ratio(a: string, b: string): number {
  return Math.round(contrastRatio(a, b) * 100) / 100;
}

/**
 * Tokens de `src/app/globals.css`, recopiés ici.
 *
 * La recopie est assumée : un test qui lirait le CSS testerait un analyseur de
 * CSS. Ce qu'on veut vérifier, ce sont les VALEURS, et un écart entre cette
 * table et la feuille de style se voit au premier coup d'œil sur le diff — les
 * deux fichiers changent dans le même commit ou pas du tout.
 */
export const TOKENS = {
  // §2.1 base, mode clair
  background: '#FAF7F7',
  foreground: '#1C0810',
  card: '#FFFFFF',

  // §2.2 bordeaux
  primary: '#630210',
  primaryForeground: '#FFFFFF',
  secondary: '#F5ECEE',
  secondaryForeground: '#630210',
  mutedForeground: '#6B4A52',

  // §2.3 or
  accent: '#C8921A',
  accentForeground: '#1C0810',
  accentText: '#856011',
  accentBorder: '#A87A15',
  accentOnDark: '#FFC65A',
  accentSurface: '#FAF4E8',

  // §2.4 statuts, mode clair
  success: '#1A6B44',
  successSurface: '#E8F0EC',
  destructive: '#B91C1C',
  destructiveSurface: '#F8E8E8',
  warning: '#856011',
  warningSurface: '#FAF4E8',
  info: '#A34462',
  infoSurface: '#F7EEF1',

  // §2.5 navigation, surfaces SOMBRES
  sidebar: '#3A010A',
  sidebarForeground: '#DFC0C8',
  sidebarAccent: '#4A0110',
  sidebarAccentForeground: '#FFFFFF',
  sidebarRing: '#B05070',

  // §3 déclinaisons sombres, réutilisées sur toute surface sombre
  darkForeground: '#F5E6EA',
  darkBackground: '#140206',
  darkCard: '#1F050C',
  darkPrimary: '#A81E33',
  darkPrimaryText: '#F0919F',
  destructiveOnDark: '#F87171',
  successOnDark: '#4FBF8B',
  warningOnDark: '#FFC65A',
  infoOnDark: '#E08BA6',

  // §2.6 séries de graphiques, mode clair
  chart1: '#630210',
  chart2: '#C8921A',
  chart3: '#1A6B44',
  chart4: '#B05070',
  chart5: '#8B5CF6',
} as const;
