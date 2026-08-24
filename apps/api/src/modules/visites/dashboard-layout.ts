import {
  DASHBOARD_MARQUES,
  DASHBOARD_PRESETS,
  DASHBOARD_SOURCES,
  type DashboardMarque,
  type DashboardPreset,
  type DashboardSource,
  type DashboardTaille,
} from './dto.js';

export interface DispositionPresentation {
  palette?: 'neutre' | 'serie' | 'categorielle';
  valeurs?: boolean;
  legende?: boolean;
  tri?: 'valeur-desc' | 'valeur-asc' | 'alphabetique';
  autresApres?: number;
}

export interface DispositionWidget {
  source: DashboardSource;
  marque?: DashboardMarque;
  taille?: DashboardTaille;
  presentation?: DispositionPresentation;
}

export interface DispositionLayout {
  version: 1;
  preset: DashboardPreset;
  widgets: DispositionWidget[];
}

const LAYOUT_VERSION = 1;
const MAX_WIDGETS = 40;

const SOURCE_SET = new Set<string>(DASHBOARD_SOURCES);
const MARQUE_SET = new Set<string>(DASHBOARD_MARQUES);
const PRESET_SET = new Set<string>(DASHBOARD_PRESETS);
const PALETTES = new Set(['neutre', 'serie', 'categorielle']);
const TRIS = new Set(['valeur-desc', 'valeur-asc', 'alphabetique']);

const CATEGORIE_MARQUES: readonly DashboardMarque[] = [
  'barres-horizontales',
  'barres-verticales',
  'camembert',
  'anneau',
  'tableau',
  'tuile',
];

const CHIFFRE_MARQUES: readonly DashboardMarque[] = ['tuile', 'jauge'];

const SERIE_TEMPORELLE_MARQUES: readonly DashboardMarque[] = [
  'courbe',
  'aire',
  'escalier',
  'barres-verticales',
  'tuile-courbe',
];

/** La marque par défaut de chaque source, et les marques compatibles avec sa forme de données. */
const SOURCE_MARQUES: Record<
  DashboardSource,
  { defaut: DashboardMarque; compatibles: readonly DashboardMarque[] }
> = {
  'total-visites': { defaut: 'tuile', compatibles: CHIFFRE_MARQUES },
  'moyenne-journaliere': { defaut: 'tuile', compatibles: CHIFFRE_MARQUES },
  'jour-le-plus-charge': { defaut: 'tuile', compatibles: ['tuile'] },
  'par-entreprise': { defaut: 'barres-horizontales', compatibles: CATEGORIE_MARQUES },
  'par-objet': { defaut: 'barres-horizontales', compatibles: CATEGORIE_MARQUES },
  'par-direction': { defaut: 'barres-horizontales', compatibles: CATEGORIE_MARQUES },
  'par-destinataire': { defaut: 'barres-horizontales', compatibles: CATEGORIE_MARQUES },
  'par-agent': { defaut: 'barres-horizontales', compatibles: CATEGORIE_MARQUES },
  'par-jour': { defaut: 'courbe', compatibles: SERIE_TEMPORELLE_MARQUES },
  'par-mois': {
    defaut: 'courbe',
    compatibles: [...SERIE_TEMPORELLE_MARQUES, 'barres-groupees'],
  },
  'par-heure': {
    defaut: 'barres-verticales',
    compatibles: ['barres-verticales', 'courbe', 'aire', 'radar', 'aire-polaire'],
  },
  'par-jour-semaine': {
    defaut: 'barres-verticales',
    compatibles: ['barres-verticales', 'radar', 'aire-polaire', 'camembert'],
  },
  'par-heure-jour-semaine': {
    defaut: 'carte-de-chaleur',
    compatibles: ['carte-de-chaleur', 'tableau'],
  },
  'par-entreprise-objet': {
    defaut: 'carte-de-chaleur',
    compatibles: [
      'carte-de-chaleur',
      'tableau',
      'barres-empilees',
      'barres-groupees',
      'barres-100',
    ],
  },
  'par-destinataire-direction': {
    defaut: 'carte-de-chaleur',
    compatibles: [
      'carte-de-chaleur',
      'tableau',
      'barres-empilees',
      'barres-groupees',
      'barres-100',
    ],
  },
  'par-objet-mois': {
    defaut: 'carte-de-chaleur',
    compatibles: [
      'carte-de-chaleur',
      'tableau',
      'barres-empilees',
      'barres-groupees',
      'barres-100',
    ],
  },
  'visiteurs-recurrents': { defaut: 'tableau', compatibles: ['tableau', 'barres-horizontales'] },
  'avec-telephone': { defaut: 'jauge', compatibles: ['jauge', 'anneau', 'tuile'] },
  'qualite-de-saisie': {
    defaut: 'barres-100',
    compatibles: ['barres-100', 'camembert', 'anneau', 'tableau'],
  },
};

function toPresentation(raw: Record<string, unknown>): DispositionPresentation | undefined {
  const presentation: DispositionPresentation = {};
  if (typeof raw.palette === 'string' && PALETTES.has(raw.palette)) {
    presentation.palette = raw.palette as 'neutre' | 'serie' | 'categorielle';
  }
  if (typeof raw.valeurs === 'boolean') presentation.valeurs = raw.valeurs;
  if (typeof raw.legende === 'boolean') presentation.legende = raw.legende;
  if (typeof raw.tri === 'string' && TRIS.has(raw.tri)) {
    presentation.tri = raw.tri as 'valeur-desc' | 'valeur-asc' | 'alphabetique';
  }
  if (
    typeof raw.autresApres === 'number' &&
    Number.isInteger(raw.autresApres) &&
    raw.autresApres >= 1
  ) {
    presentation.autresApres = raw.autresApres;
  }
  return Object.keys(presentation).length === 0 ? undefined : presentation;
}

function toWidget(raw: Record<string, unknown>): DispositionWidget | null {
  if (typeof raw.source !== 'string') return null;
  const widget: DispositionWidget = { source: raw.source as DashboardSource };
  if (typeof raw.marque === 'string') widget.marque = raw.marque as DashboardMarque;
  if (typeof raw.taille === 'string') widget.taille = raw.taille as DashboardTaille;
  if (typeof raw.presentation === 'object' && raw.presentation !== null) {
    const presentation = toPresentation(raw.presentation as Record<string, unknown>);
    if (presentation !== undefined) widget.presentation = presentation;
  }
  return widget;
}

/** Rend `null` sur une version inconnue ou une forme qui ne tient pas : le repli prend le relais. */
export function parseLayout(value: unknown): DispositionLayout | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== LAYOUT_VERSION) return null;
  if (!Array.isArray(record.widgets)) return null;

  const preset =
    typeof record.preset === 'string' && PRESET_SET.has(record.preset)
      ? (record.preset as DashboardPreset)
      : 'essentiel';

  const widgets: DispositionWidget[] = [];
  for (const raw of record.widgets as unknown[]) {
    if (typeof raw !== 'object' || raw === null) continue;
    const widget = toWidget(raw as Record<string, unknown>);
    if (widget !== null) widgets.push(widget);
  }

  return { version: 1, preset, widgets };
}

/**
 * Retire les sources inconnues, déduplique, plafonne. Une marque inconnue ou
 * devenue incompatible retombe sur la marque par défaut de sa source : elle
 * ne fait jamais disparaître l'élément, sous peine d'un écran cassé en silence
 * chez qui l'a choisi.
 */
export function sanitize(widgets: readonly DispositionWidget[]): DispositionWidget[] {
  const seen = new Set<DashboardSource>();
  const cleaned: DispositionWidget[] = [];

  for (const widget of widgets) {
    if (!SOURCE_SET.has(widget.source)) continue;
    if (seen.has(widget.source)) continue;
    seen.add(widget.source);

    const rules = SOURCE_MARQUES[widget.source];
    const marque =
      widget.marque !== undefined &&
      MARQUE_SET.has(widget.marque) &&
      rules.compatibles.includes(widget.marque)
        ? widget.marque
        : rules.defaut;

    cleaned.push({
      source: widget.source,
      marque,
      ...(widget.taille === undefined ? {} : { taille: widget.taille }),
      ...(widget.presentation === undefined ? {} : { presentation: widget.presentation }),
    });

    if (cleaned.length >= MAX_WIDGETS) break;
  }

  return cleaned;
}

/**
 * Une lecture bout en bout : version acceptée, sources connues, marques
 * cohérentes. `null` si, une fois nettoyée, il ne reste plus rien à montrer —
 * le chaînon appelant passe alors au repli suivant.
 */
export function resolveLayout(value: unknown): DispositionLayout | null {
  const parsed = parseLayout(value);
  if (parsed === null) return null;
  const widgets = sanitize(parsed.widgets);
  if (widgets.length === 0) return null;
  return { version: 1, preset: parsed.preset, widgets };
}

export const DISPOSITION_USINE: DispositionLayout = {
  version: 1,
  preset: 'essentiel',
  widgets: sanitize([
    { source: 'total-visites' },
    { source: 'moyenne-journaliere' },
    { source: 'jour-le-plus-charge' },
    { source: 'par-jour' },
    { source: 'par-entreprise' },
    { source: 'par-objet' },
    { source: 'qualite-de-saisie' },
  ]),
};
