import { apiClient, unwrap } from '@/api/client';
import type { components, operations } from '@/api/schema';

export type EcranDisposition = operations['getDashboardLayout']['parameters']['path']['ecran'];
export type DispositionWidgetApi = components['schemas']['DispositionWidget'];
export type Marque = NonNullable<DispositionWidgetApi['marque']>;
export type Taille = NonNullable<DispositionWidgetApi['taille']>;
export type Presentation = NonNullable<DispositionWidgetApi['presentation']>;
export type Preset = components['schemas']['DispositionOutputBody']['preset'];

export interface Widget {
  id: string;
  source: string;
  marque?: Marque | undefined;
  taille?: Taille | undefined;
  presentation?: Presentation | undefined;
}

export interface Disposition {
  widgets: Widget[];
  preset: Preset;
  source: 'utilisateur' | 'defaut' | 'usine';
  updatedAt: string | null;
}

/**
 * Le seul point de sérialisation d'un widget : le serveur rejette la requête
 * entière au moindre champ étranger, une clé de rendu (`id`) comprise.
 */
function serializeWidget(widget: Widget): DispositionWidgetApi {
  return {
    source: widget.source,
    ...(widget.marque === undefined ? {} : { marque: widget.marque }),
    ...(widget.taille === undefined ? {} : { taille: widget.taille }),
    ...(widget.presentation === undefined ? {} : { presentation: widget.presentation }),
  };
}

export function serializeDisposition(
  widgets: readonly Widget[],
  preset?: Preset,
): { preset?: Preset; widgets: DispositionWidgetApi[] } {
  return {
    ...(preset === undefined ? {} : { preset }),
    widgets: widgets.map(serializeWidget),
  };
}

function enDisposition(corps: components['schemas']['DispositionOutputBody']): Disposition {
  return {
    widgets: (corps.widgets ?? []).map((widget, index) => ({
      id: `${widget.source}-${String(index)}`,
      source: widget.source,
      ...(widget.marque === undefined ? {} : { marque: widget.marque }),
      ...(widget.taille === undefined ? {} : { taille: widget.taille }),
      ...(widget.presentation === undefined ? {} : { presentation: widget.presentation }),
    })),
    preset: corps.preset,
    source: corps.source,
    updatedAt: corps.updatedAt,
  };
}

export async function fetchDisposition(ecran: EcranDisposition): Promise<Disposition> {
  return enDisposition(
    unwrap(
      await apiClient.GET('/api/v1/tableaux-de-bord/{ecran}/disposition', {
        params: { path: { ecran } },
      }),
    ),
  );
}

export async function enregistrerDisposition(
  ecran: EcranDisposition,
  widgets: readonly Widget[],
  preset: Preset | undefined,
): Promise<Disposition> {
  return enDisposition(
    unwrap(
      await apiClient.PUT('/api/v1/tableaux-de-bord/{ecran}/disposition', {
        params: { path: { ecran } },
        body: serializeDisposition(widgets, preset),
      }),
    ),
  );
}

export async function enregistrerDispositionParDefaut(
  ecran: EcranDisposition,
  widgets: readonly Widget[],
  preset: Preset | undefined,
): Promise<Disposition> {
  return enDisposition(
    unwrap(
      await apiClient.PUT('/api/v1/tableaux-de-bord/{ecran}/disposition/par-defaut', {
        params: { path: { ecran } },
        body: serializeDisposition(widgets, preset),
      }),
    ),
  );
}

export async function reinitialiserDisposition(ecran: EcranDisposition): Promise<Disposition> {
  unwrap(
    await apiClient.DELETE('/api/v1/tableaux-de-bord/{ecran}/disposition', {
      params: { path: { ecran } },
    }),
  );
  return fetchDisposition(ecran);
}
