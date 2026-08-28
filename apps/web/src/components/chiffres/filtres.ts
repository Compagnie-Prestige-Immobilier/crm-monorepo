import {
  dashboardFiltersFromParams,
  dashboardFiltersAdapter,
  type DashboardFilters,
} from '@/components/accueil/tableau-de-bord/selecteur-periode';
import type { UrlFilterAdapter } from '@/components/filters/use-url-filters';

export interface ChiffresFilters extends DashboardFilters {
  /** Un seul téléconseiller, ou toute l'équipe. */
  teleconseiller: string | null;
}

/**
 * La période du tableau de bord, plus le téléconseiller regardé. Les deux
 * vivent dans l'URL : un superviseur envoie l'adresse telle quelle et l'autre
 * voit exactement le même écran.
 */
export const chiffresFiltersAdapter: UrlFilterAdapter<ChiffresFilters> = {
  parse: (params) => ({
    ...dashboardFiltersFromParams(params),
    teleconseiller: params.get('teleconseiller'),
  }),
  serialize: ({ teleconseiller, ...periode }) => {
    const params = dashboardFiltersAdapter.serialize(periode);
    if (teleconseiller !== null) params.set('teleconseiller', teleconseiller);
    return params;
  },
  cleared: () => ({
    ...dashboardFiltersAdapter.cleared({} as DashboardFilters),
    teleconseiller: null,
  }),
};
