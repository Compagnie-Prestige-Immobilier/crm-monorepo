import { EMPTY_REPRESENTANT_FILTERS } from '@/lib/representant-filters';

// Hors de `hub-view.tsx` : un module « use client » n'expose au serveur que des
// références client, et la page en tirait `{...undefined}` — donc des filtres
// sans `search`, et un écran d'ouverture en erreur.

/** Les représentants qu'on n'a pas encore appelés. */
export const A_APPELER = {
  ...EMPTY_REPRESENTANT_FILTERS,
  relationStatus: 'INCONNU' as const,
  pageSize: 1,
};

/** Ceux qui ont accepté sans qu'un seul contact ait été noté derrière. */
export const SANS_PROSPECT = {
  ...EMPTY_REPRESENTANT_FILTERS,
  relationStatus: 'AMBASSADEUR' as const,
  hasProspects: false,
  pageSize: 1,
};

export const hubKeys = {
  prospectsEnAttente: ['chues', 'hub', 'prospects-en-attente'] as const,
};
