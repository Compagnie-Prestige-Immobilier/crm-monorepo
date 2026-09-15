/**
 * Racines d'avant le découpage en coques, et leur destination.
 *
 * Les notifications DÉJÀ ENVOYÉES portent ces chemins en base (voir la liste
 * blanche de `lib/data/inbox.ts`) : sans ces renvois, chacun de leurs liens
 * tombe en 404 le jour du déploiement.
 */
const MOVED_ROUTES: Readonly<Record<string, string>> = {
  'tableau-de-bord': '/teleconseil/tableau-de-bord',
  statistiques: '/teleconseil/tableau-de-bord',
  prospects: '/teleconseil/prospects',
  campagnes: '/teleconseil/campagnes',
  console: '/teleconseil/console',
  rappels: '/teleconseil/rappels',
  representants: '/teleconseil/representants',
  suggestions: '/teleconseil/suggestions',
  banque: '/finance',
  dossiers: '/finance/dossiers',
  'demandes-clients': '/finance/demandes-clients',
  supervision: '/teleconseil/supervision',
  commerciaux: '/admin/commerciaux',
  referentiels: '/admin/referentiels',
  imports: '/admin/imports',
  parametres: '/admin/parametres',
  notifications: '/admin/notifications',

  // Adresses des rappels quotidiens d'avant le retrait des campagnes : plus rien
  // ne les émet, mais des notifications déjà envoyées les portent.
  phase2: '/teleconseil/campagnes',
  'rep-campaigns': '/teleconseil/campagnes',
};

/**
 * Adresses COMPLÈTES dont la racine seule mènerait ailleurs.
 */
const MOVED_PATHS: Readonly<Record<string, string>> = {
  '/phase2/callbacks': '/teleconseil/rappels',
};

export type SearchParams = Record<string, string | string[] | undefined>;

function appendSearchValue(query: URLSearchParams, key: string, value: string | string[]): void {
  if (!Array.isArray(value)) {
    query.set(key, value);
    return;
  }
  for (const item of value) query.append(key, item);
}

function buildQueryString(search: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined) appendSearchValue(query, key, value);
  }
  return query.size === 0 ? '' : `?${query.toString()}`;
}

const BANK_SUBROUTES = new Set(['banque', 'dossiers', 'demandes-clients']);

function buildSubPath(segments: readonly string[]): string {
  if (segments.length === 0) return '';
  return `/${segments.map(encodeURIComponent).join('/')}`;
}

function movedCoqueTarget(segments: readonly string[], search: SearchParams): string {
  const head = segments[0];
  if (head === undefined) return `/teleconseil${buildQueryString(search)}`;
  const tail = buildSubPath(segments.slice(1));
  const query = buildQueryString(search);
  if (head === 'banque') return `/finance${query}`;
  const targetCoque = BANK_SUBROUTES.has(head) ? '/finance' : '/teleconseil';
  return `${targetCoque}/${head}${tail}${query}`;
}

/**
 * Destination d'une ancienne adresse, ou `null` si la racine n'a jamais
 * existé. Le reste du chemin et la requête suivent.
 */
export function movedTarget(
  root: string,
  segments: readonly string[] = [],
  search: SearchParams = {},
): string | null {
  if (root === 'chues' || root === 'grand-public') {
    return movedCoqueTarget(segments, search);
  }

  const tail = buildSubPath(segments);
  const exact = MOVED_PATHS[`/${root}${tail}`];

  const base = exact ?? MOVED_ROUTES[root];
  if (base === undefined) return null;

  return `${base}${exact === undefined ? tail : ''}${buildQueryString(search)}`;
}
