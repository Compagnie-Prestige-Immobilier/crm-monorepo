import type { ApiClient, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type {
  DashboardMarque,
  DashboardPreset,
  DashboardSource,
  DashboardTaille,
  DispositionPresentation,
} from '@/components/accueil/tableau-de-bord/sources';

export type DashboardEcran = operations['getDashboardLayout']['parameters']['path']['ecran'];

export interface DashboardWidget {
  id: string;
  source: DashboardSource;
  marque?: DashboardMarque | undefined;
  taille?: DashboardTaille | undefined;
  presentation?: DispositionPresentation | undefined;
}

export interface Disposition {
  widgets: DashboardWidget[];
  preset: DashboardPreset;
  source: 'utilisateur' | 'defaut' | 'usine';
  updatedAt: string | null;
}

function widgetId(source: DashboardSource, index: number): string {
  return `${source}-${String(index)}`;
}

/**
 * Le seul point de sérialisation d'un widget vers l'API : `forbidNonWhitelisted`
 * y rejette la requête entière au moindre champ étranger, une clé client (id)
 * comprise.
 */
export function serializeWidget(widget: DashboardWidget): {
  source: DashboardSource;
  marque?: DashboardMarque;
  taille?: DashboardTaille;
  presentation?: DispositionPresentation;
} {
  return {
    source: widget.source,
    ...(widget.marque === undefined ? {} : { marque: widget.marque }),
    ...(widget.taille === undefined ? {} : { taille: widget.taille }),
    ...(widget.presentation === undefined ? {} : { presentation: widget.presentation }),
  };
}

export function serializeDisposition(
  widgets: readonly DashboardWidget[],
  preset?: DashboardPreset,
): { preset?: DashboardPreset; widgets: ReturnType<typeof serializeWidget>[] } {
  return {
    ...(preset === undefined ? {} : { preset }),
    widgets: widgets.map(serializeWidget),
  };
}

function toDisposition(response: {
  widgets: {
    source: DashboardSource;
    marque?: DashboardMarque;
    taille?: DashboardTaille;
    presentation?: DispositionPresentation;
  }[];
  preset: DashboardPreset;
  source: 'utilisateur' | 'defaut' | 'usine';
  updatedAt: string | null;
}): Disposition {
  return {
    widgets: response.widgets.map((widget, index) => ({
      id: widgetId(widget.source, index),
      ...widget,
    })),
    preset: response.preset,
    source: response.source,
    updatedAt: response.updatedAt,
  };
}

export async function fetchDisposition(
  ecran: DashboardEcran,
  client: ApiClient = getApiClient(),
): Promise<Disposition> {
  return toDisposition(
    unwrap(
      await client.GET('/api/v1/tableaux-de-bord/{ecran}/disposition', {
        params: { path: { ecran } },
      }),
    ),
  );
}

export async function saveDisposition(
  ecran: DashboardEcran,
  widgets: readonly DashboardWidget[],
  preset: DashboardPreset | undefined,
  client: ApiClient = getApiClient(),
): Promise<Disposition> {
  return toDisposition(
    unwrap(
      await client.PUT('/api/v1/tableaux-de-bord/{ecran}/disposition', {
        params: { path: { ecran } },
        body: serializeDisposition(widgets, preset),
      }),
    ),
  );
}

export async function resetDisposition(
  ecran: DashboardEcran,
  client: ApiClient = getApiClient(),
): Promise<Disposition> {
  unwrap(
    await client.DELETE('/api/v1/tableaux-de-bord/{ecran}/disposition', {
      params: { path: { ecran } },
    }),
  );
  return fetchDisposition(ecran, client);
}

export async function saveDefaultDisposition(
  ecran: DashboardEcran,
  widgets: readonly DashboardWidget[],
  preset: DashboardPreset | undefined,
  client: ApiClient = getApiClient(),
): Promise<Disposition> {
  return toDisposition(
    unwrap(
      await client.PUT('/api/v1/tableaux-de-bord/{ecran}/disposition/par-defaut', {
        params: { path: { ecran } },
        body: serializeDisposition(widgets, preset),
      }),
    ),
  );
}
