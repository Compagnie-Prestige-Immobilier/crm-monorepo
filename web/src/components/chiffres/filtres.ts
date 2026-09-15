import {
  dashboardFiltersFromParams,
  dashboardFiltersAdapter,
  type DashboardFilters,
} from '@/components/accueil/tableau-de-bord/selecteur-periode';
import type { UrlFilterAdapter } from '@/components/filters/use-url-filters';
import type { Projet } from '@/lib/types';

export interface ChiffresFilters extends DashboardFilters {
  /** Un seul téléconseiller, ou toute l'équipe. */
  teleconseiller: string | null;
  /** Le projet métier (null = tous les projets). */
  projet: Projet | null;
  /** Une seule campagne d'appels prospects, ou toutes. */
  campagne: string | null;
}

/**
 * La période du tableau de bord, plus le téléconseiller, le projet et la
 * campagne regardés. Tous vivent dans l'URL : un superviseur envoie l'adresse
 * telle quelle et l'autre voit exactement le même écran.
 */
export const chiffresFiltersAdapter: UrlFilterAdapter<ChiffresFilters> = {
  parse: (params) => {
    const rawProjet = params.get('projet');
    const projet = rawProjet === 'CHUES' || rawProjet === 'GRAND_PUBLIC' ? rawProjet : null;
    return {
      ...dashboardFiltersFromParams(params),
      teleconseiller: params.get('teleconseiller'),
      projet,
      campagne: params.get('campagne'),
    };
  },
  serialize: ({ teleconseiller, projet, campagne, ...periode }) => {
    const params = dashboardFiltersAdapter.serialize(periode);
    if (teleconseiller !== null) params.set('teleconseiller', teleconseiller);
    if (projet !== null) params.set('projet', projet);
    if (campagne !== null) params.set('campagne', campagne);
    return params;
  },
  cleared: () => ({
    ...dashboardFiltersAdapter.cleared({} as DashboardFilters),
    teleconseiller: null,
    projet: null,
    campagne: null,
  }),
};
