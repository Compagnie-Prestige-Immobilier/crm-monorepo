import {
  DASHBOARD_MARQUES,
  DASHBOARD_PRESETS,
  SOURCES_PAR_ECRAN,
  type DashboardEcran,
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
  version: 2;
  preset: DashboardPreset;
  widgets: DispositionWidget[];
}

const LAYOUT_VERSION = 2;
const MAX_WIDGETS = 40;

/**
 * Version 1 : ces trois clés mesuraient par tentative sous d'autres noms.
 * `taux-de-contact` et `taux-de-qualification` existent toujours en version 2,
 * avec le sens de l'expression de besoins (EB-33) : relire une version 1 sans
 * cette table les afficherait avec un autre chiffre.
 */
const RENOMMAGES_V1: Readonly<Record<string, DashboardSource>> = {
  'taux-de-contact': 'taux-de-joignabilite-representants',
  'taux-de-qualification': 'taux-d-acceptation',
  'a-rappeler': 'taux-de-rappel',
};

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
];

const CHIFFRE_MARQUES: readonly DashboardMarque[] = ['tuile'];

const SERIE_TEMPORELLE_MARQUES: readonly DashboardMarque[] = [
  'courbe',
  'aire',
  'escalier',
  'barres-verticales',
];

const COMPOSITION_MARQUES: readonly DashboardMarque[] = [
  'barres-100',
  'barres-empilees',
  'camembert',
  'anneau',
  'tableau',
];

const MATRICE_MARQUES: readonly DashboardMarque[] = ['carte-de-chaleur', 'tableau'];

interface ReglesDeMarque {
  defaut: DashboardMarque;
  compatibles: readonly DashboardMarque[];
}

const CHIFFRE: ReglesDeMarque = { defaut: 'tuile', compatibles: CHIFFRE_MARQUES };
const TAUX: ReglesDeMarque = { defaut: 'tuile', compatibles: CHIFFRE_MARQUES };
const CLASSEMENT: ReglesDeMarque = {
  defaut: 'barres-horizontales',
  compatibles: CATEGORIE_MARQUES,
};
const MATRICE: ReglesDeMarque = { defaut: 'carte-de-chaleur', compatibles: MATRICE_MARQUES };

/** La marque par défaut de chaque source, et les marques compatibles avec sa forme de données. */
const SOURCE_MARQUES: Record<DashboardSource, ReglesDeMarque> = {
  'total-visites': CHIFFRE,
  'moyenne-journaliere': CHIFFRE,
  'jour-le-plus-charge': { defaut: 'tuile', compatibles: ['tuile'] },
  'par-entreprise': CLASSEMENT,
  'par-objet': CLASSEMENT,
  'par-direction': CLASSEMENT,
  'par-destinataire': CLASSEMENT,
  'par-agent': CLASSEMENT,
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
  'par-heure-jour-semaine': MATRICE,
  'par-entreprise-objet': { defaut: 'carte-de-chaleur', compatibles: MATRICE_MARQUES },
  'par-destinataire-direction': { defaut: 'carte-de-chaleur', compatibles: MATRICE_MARQUES },
  'par-objet-mois': { defaut: 'carte-de-chaleur', compatibles: MATRICE_MARQUES },
  'visiteurs-recurrents': { defaut: 'tableau', compatibles: ['tableau', 'barres-horizontales'] },
  'avec-telephone': { defaut: 'anneau', compatibles: COMPOSITION_MARQUES },
  'qualite-de-saisie': {
    defaut: 'barres-100',
    compatibles: ['barres-100', 'camembert', 'anneau', 'tableau'],
  },

  'taux-de-contact': TAUX,
  'taux-de-joignabilite-representants': TAUX,
  'taux-d-acceptation': TAUX,
  'taux-de-rappel': TAUX,
  'repartition-statuts-qualification': CLASSEMENT,
  'joints-non-joints': { defaut: 'barres-verticales', compatibles: CATEGORIE_MARQUES },
  'statuts-par-famille': { defaut: 'barres-empilees', compatibles: COMPOSITION_MARQUES },
  'joignabilite-par-creneau': MATRICE,
  'taux-d-exploitation': { defaut: 'camembert', compatibles: CATEGORIE_MARQUES },
  'exploitation-par-campagne': {
    defaut: 'barres-100',
    compatibles: ['barres-100', 'barres-empilees', 'tableau'],
  },
  'representants-par-departement': CLASSEMENT,
  'representants-par-ief': CLASSEMENT,
  'representants-jamais-appeles': CHIFFRE,
  'representants-injoignables': CHIFFRE,
  'taux-de-joignabilite': TAUX,
  'prospects-notes': { defaut: 'tuile', compatibles: CHIFFRE_MARQUES },
  adhesions: CHIFFRE,
  'reste-a-appeler': { defaut: 'tuile', compatibles: ['tuile'] },
  'fiches-ouvertes': MATRICE,
  'taux-de-qualification': TAUX,
  'duree-moyenne-sur-la-fiche': CHIFFRE,
  'duree-moyenne-de-communication': CHIFFRE,
  'appels-par-jour': { defaut: 'courbe', compatibles: SERIE_TEMPORELLE_MARQUES },
  'par-teleconseiller': { defaut: 'tableau', compatibles: ['tableau'] },
  'couverture-derniere-campagne': {
    defaut: 'barres-100',
    compatibles: ['barres-100', 'barres-empilees', 'tableau'],
  },
  'hors-attribution-derniere-campagne': CLASSEMENT,
  encaisse: CHIFFRE,
  'de-l-appel-a-l-encaissement': CLASSEMENT,
  'methodes-d-adhesion': { defaut: 'anneau', compatibles: COMPOSITION_MARQUES },
  'par-banque': { defaut: 'anneau', compatibles: COMPOSITION_MARQUES },
  'delais-medians': CLASSEMENT,
  'rendement-par-departement': CLASSEMENT,

  'enrolement-inscriptions': CHIFFRE,
  'enrolement-taux-rapprochement': TAUX,
  'enrolement-taux-conversion': TAUX,
  'enrolement-par-jour': { defaut: 'courbe', compatibles: SERIE_TEMPORELLE_MARQUES },
  'enrolement-par-etape': { defaut: 'camembert', compatibles: COMPOSITION_MARQUES },
  'enrolement-par-teleconseiller': CLASSEMENT,
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
  if (record.version !== LAYOUT_VERSION && record.version !== 1) return null;
  if (!Array.isArray(record.widgets)) return null;

  const preset =
    typeof record.preset === 'string' && PRESET_SET.has(record.preset)
      ? (record.preset as DashboardPreset)
      : 'essentiel';

  const widgets: DispositionWidget[] = [];
  for (const raw of record.widgets as unknown[]) {
    if (typeof raw !== 'object' || raw === null) continue;
    const widget = toWidget(raw as Record<string, unknown>);
    if (widget === null) continue;
    if (record.version === 1) widget.source = RENOMMAGES_V1[widget.source] ?? widget.source;
    widgets.push(widget);
  }

  return { version: LAYOUT_VERSION, preset, widgets };
}

/**
 * Retire les sources étrangères à l'écran, déduplique, plafonne. Une marque
 * inconnue ou devenue incompatible retombe sur la marque par défaut de sa
 * source : elle ne fait jamais disparaître l'élément, sous peine d'un écran
 * cassé en silence chez qui l'a choisi.
 */
export function sanitize(
  ecran: DashboardEcran,
  widgets: readonly DispositionWidget[],
): DispositionWidget[] {
  const admises = new Set<string>(SOURCES_PAR_ECRAN[ecran]);
  const seen = new Set<DashboardSource>();
  const cleaned: DispositionWidget[] = [];

  for (const widget of widgets) {
    if (!admises.has(widget.source)) continue;
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
 * Une lecture bout en bout : version acceptée, sources connues de l'écran,
 * marques cohérentes. `null` si, une fois nettoyée, il ne reste plus rien à
 * montrer : le chaînon appelant passe alors au repli suivant.
 */
export function resolveLayout(
  ecran: DashboardEcran,
  value: unknown,
  options: { videAutorise: boolean } = { videAutorise: false },
): DispositionLayout | null {
  const parsed = parseLayout(value);
  if (parsed === null) return null;
  const widgets = sanitize(ecran, parsed.widgets);
  // Un compte peut vouloir un écran vide ; une disposition par défaut vide retombe sur l'usine.
  if (widgets.length === 0 && !options.videAutorise) return null;
  return { version: LAYOUT_VERSION, preset: parsed.preset, widgets };
}

/**
 * Ce qu'un compte voit à sa première ouverture : une ligne de taux, le tableau
 * par téléconseiller dessous. Courte à dessein, et tout y est déplaçable et
 * retirable comme le reste.
 */
type WidgetUsine = DashboardSource | DispositionWidget;

const USINE: Record<DashboardEcran, readonly WidgetUsine[]> = {
  visites: [
    'total-visites',
    'moyenne-journaliere',
    'jour-le-plus-charge',
    'par-jour',
    'par-entreprise',
    'par-objet',
    'qualite-de-saisie',
  ],
  chues: [
    'taux-de-contact',
    'taux-de-joignabilite-representants',
    'taux-d-acceptation',
    'taux-de-qualification',
    {
      source: 'repartition-statuts-qualification',
      taille: 'pleine',
      presentation: { valeurs: true },
    },
    'par-teleconseiller',
    { source: 'fiches-ouvertes', taille: 'pleine' },
    'couverture-derniere-campagne',
    'hors-attribution-derniere-campagne',
    'rendement-par-departement',
  ],
  'grand-public': [
    'taux-de-joignabilite',
    'prospects-notes',
    'adhesions',
    'par-teleconseiller',
    { source: 'fiches-ouvertes', taille: 'pleine' },
    'couverture-derniere-campagne',
    'hors-attribution-derniere-campagne',
    'methodes-d-adhesion',
  ],
};

/** Les montants, ajoutés en fin d'écran pour l'administrateur et la direction. */
const USINE_MONTANTS: Record<DashboardEcran, readonly DashboardSource[]> = {
  visites: [],
  chues: ['encaisse', 'de-l-appel-a-l-encaissement'],
  'grand-public': ['encaisse', 'de-l-appel-a-l-encaissement'],
};

function widgetUsine(item: WidgetUsine): DispositionWidget {
  return typeof item === 'string' ? { source: item } : item;
}

export function dispositionUsine(
  ecran: DashboardEcran,
  voitLesMontants = false,
): DispositionLayout {
  const sources = voitLesMontants ? [...USINE[ecran], ...USINE_MONTANTS[ecran]] : USINE[ecran];
  return {
    version: LAYOUT_VERSION,
    preset: 'essentiel',
    widgets: sanitize(ecran, sources.map(widgetUsine)),
  };
}
