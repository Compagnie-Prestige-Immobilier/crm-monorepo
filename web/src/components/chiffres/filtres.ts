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
}

/**
 * La période du tableau de bord, plus le téléconseiller et le projet regardés. Les trois
 * vivent dans l'URL : un superviseur envoie l'adresse telle quelle et l'autre
 * voit exactement le même écran.
 */
export const chiffresFiltersAdapter: UrlFilterAdapter<ChiffresFilters> = {
  parse: (params) => {
    const rawProjet = params.get('projet');
    const projet = rawProjet === 'CHUES' || rawProjet === 'GRAND_PUBLIC' ? rawProjet : null;
    return {
      ...dashboardFiltersFromParams(params),
      teleconseiller: params.get('teleconseiller'),
      projet,
    };
  },
  serialize: ({ teleconseiller, projet, ...periode }) => {
    const params = dashboardFiltersAdapter.serialize(periode);
    if (teleconseiller !== null) params.set('teleconseiller', teleconseiller);
    if (projet !== null) params.set('projet', projet);
    return params;
  },
  cleared: () => ({
    ...dashboardFiltersAdapter.cleared({} as DashboardFilters),
    teleconseiller: null,
    projet: null,
  }),
};
