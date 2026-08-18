export const AA_TEXT = 4.5;
export const AA_LARGE = 3;

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

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

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(color: Rgb): number {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(parseHex(a));
  const second = relativeLuminance(parseHex(b));
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function ratio(a: string, b: string): number {
  return Math.round(contrastRatio(a, b) * 100) / 100;
}

export const TOKENS = {
  background: '#FFFFFF',
  foreground: '#1C0810',
  card: '#FBFBFC',
  popover: '#FFFFFF',
  inputBorder: '#AF7D84',

  primary: '#630210',
  primaryForeground: '#FFFFFF',
  secondary: '#F4F4F6',
  secondaryForeground: '#630210',
  muted: '#EEEEF1',
  mutedForeground: '#6B4A52',
  ring: '#630210',

  accent: '#C8921A',
  accentForeground: '#1C0810',
  accentText: '#856011',
  accentBorder: '#A87A15',
  accentOnDark: '#FFC65A',
  accentSurface: '#FAF4E8',

  success: '#1A6B44',
  successSurface: '#E8F0EC',
  destructive: '#B91C1C',
  destructiveSurface: '#F8E8E8',
  warning: '#856011',
  warningSurface: '#FAF4E8',
  info: '#A34462',
  infoSurface: '#F7EEF1',

  sidebar: '#3A010A',
  sidebarForeground: '#DFC0C8',
  sidebarMutedForeground: '#C09AA4',
  sidebarAccent: '#4A0110',
  sidebarAccentForeground: '#FFFFFF',
  sidebarRing: '#B05070',

  destructiveOnDark: '#F87171',
  successOnDark: '#4FBF8B',
  warningOnDark: '#FFC65A',
  infoOnDark: '#E08BA6',

  darkBackground: '#141315',
  darkForeground: '#F2EFF0',
  darkCard: '#1C1A1D',
  darkInputBorder: '#877078',
  darkPrimary: '#A81E33',
  darkPrimaryText: '#F0919F',
  darkMutedForeground: '#C4A0AA',
  darkSidebar: '#300710',
  darkSidebarForeground: '#E8CCD3',
  darkSidebarAccent: '#4A0E1C',

  chart1: '#630210',
  chart2: '#C8921A',
  chart3: '#1A6B44',
  chart4: '#B05070',
  chart5: '#8B5CF6',
  darkChart1: '#D9647A',
  darkChart2: '#FFC65A',
  darkChart3: '#4FBF8B',
  darkChart4: '#E08BA6',
  darkChart5: '#B79BFF',
} as const;
