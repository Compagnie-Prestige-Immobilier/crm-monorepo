/**
 * Racines d'avant le découpage en coques. Des notifications déjà envoyées
 * portent ces chemins en base : sans ces renvois, leurs liens tombent en 404.
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
  phase2: '/chues/campagnes',
  'rep-campaigns': '/chues/campagnes',
};

/** `/phase2/callbacks` est l'écran des rappels, pas une sous-page des lots. */
const MOVED_PATHS: Readonly<Record<string, string>> = {
  '/phase2/callbacks': '/chues/rappels',
};

/**
 * Destination d'une ancienne adresse, ou `null` si la racine n'a jamais existé.
 * Le reste du chemin et la requête suivent.
 */
export function movedTarget(segments: readonly string[], recherche: string): string | null {
  const [racine, ...reste] = segments;
  if (racine === undefined) return null;

  const queue = reste.map((segment) => `/${encodeURIComponent(segment)}`).join('');
  const exact = MOVED_PATHS[`/${racine}${queue}`];
  const base = exact ?? MOVED_ROUTES[racine];
  if (base === undefined) return null;

  return `${base}${exact === undefined ? queue : ''}${recherche}`;
}
