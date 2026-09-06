/**
 * Racines d'avant le découpage en coques, et leur destination.
 *
 * Les notifications DÉJÀ ENVOYÉES portent ces chemins en base (voir la liste
 * blanche de `lib/data/inbox.ts`) : sans ces renvois, chacun de leurs liens
 * tombe en 404 le jour du déploiement.
 */
const MOVED_ROUTES: Readonly<Record<string, string>> = {
  'tableau-de-bord': '/chues/tableau-de-bord',
  statistiques: '/chues/statistiques',
  prospects: '/chues/prospects',
  campagnes: '/chues/campagnes',
  console: '/chues/console',
  rappels: '/chues/rappels',
  representants: '/chues/representants',
  suggestions: '/chues/suggestions',
  banque: '/chues/banque',
  dossiers: '/chues/dossiers',
  'demandes-clients': '/chues/demandes-clients',
  supervision: '/chues/supervision',
  commerciaux: '/admin/commerciaux',
  referentiels: '/admin/referentiels',
  imports: '/admin/imports',
  parametres: '/admin/parametres',
  notifications: '/admin/notifications',

  // Adresses des rappels quotidiens d'avant le retrait des campagnes : plus rien
  // ne les émet, mais des notifications déjà envoyées les portent.
  phase2: '/chues/campagnes',
  'rep-campaigns': '/chues/campagnes',
};

/**
 * Adresses COMPLÈTES dont la racine seule mènerait ailleurs.
 *
 * `/phase2/callbacks` est l'écran des rappels, pas une sous-page des lots : la
 * règle de préfixe l'enverrait sur `/chues/campagnes/callbacks`, qui n'existe
 * pas.
 */
const MOVED_PATHS: Readonly<Record<string, string>> = {
  '/phase2/callbacks': '/chues/rappels',
};

export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Destination d'une ancienne adresse, ou `null` si la racine n'a jamais
 * existé. Le reste du chemin et la requête suivent : un lien de notification
 * vise un dossier précis, et une barre de filtres se partage avec sa requête.
 */
export function movedTarget(
  root: string,
  segments: readonly string[] = [],
  search: SearchParams = {},
): string | null {
  const tail = segments.map((segment) => `/${encodeURIComponent(segment)}`).join('');
  const exact = MOVED_PATHS[`/${root}${tail}`];

  const base = exact ?? MOVED_ROUTES[root];
  if (base === undefined) return null;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) for (const item of value) query.append(key, item);
    else if (value !== undefined) query.set(key, value);
  }

  const suffix = query.size === 0 ? '' : `?${query.toString()}`;
  return `${base}${exact === undefined ? tail : ''}${suffix}`;
}
