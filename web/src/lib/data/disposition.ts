import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';
import { z } from 'zod';

import { getApiClient } from '@/lib/api/browser';
import type { DashboardPreset, DonneesSource } from '@/components/accueil/tableau-de-bord/sources';

type Schemas = components['schemas'];

export type DashboardEcran = operations['getDashboardLayout']['parameters']['path']['ecran'];
export type Calcul = Schemas['Calcul'];
export type Proposition = Schemas['Proposition'];
export type EntreeCatalogueApi = Schemas['EntreeCatalogue'];
export type ReponseConstructeur = Schemas['ConstruireOutputBody'];
export type Amorce = Schemas['Amorce'];
export type DashboardWidget = Schemas['DispositionWidget'] & { id: string };

export const SOURCE_CALCUL = 'calcul';

export interface Disposition {
  widgets: DashboardWidget[];
  preset: DashboardPreset;
  source: 'utilisateur' | 'defaut' | 'usine';
  updatedAt: string | null;
}

export interface CalculRendu {
  titre: string;
  donnees?: DonneesSource;
  erreur?: string;
  explication?: string;
}

// L'identifiant suit le contenu : un déplacement ne renomme pas la carte, qui ne se remonte pas.
function widgetIds(widgets: readonly Schemas['DispositionWidget'][]): string[] {
  const vus = new Set<string>();
  return widgets.map((widget, index) => {
    const c = widget.calcul;
    const brut =
      c === undefined
        ? widget.source
        : [SOURCE_CALCUL, c.outil, c.axe, c.periode, c.projet, ...(c.mesures ?? [])].join('-');
    const id = brut
      .normalize('NFD')
      .replace(/[^a-zA-Z0-9-]+/gu, '-')
      .toLowerCase();
    const unique = vus.has(id) ? `${id}-${String(index)}` : id;
    vus.add(unique);
    return unique;
  });
}

function serializeWidget({ id: _id, ...widget }: DashboardWidget): Schemas['DispositionWidget'] {
  return widget;
}

function toDisposition(response: Schemas['DispositionOutputBody']): Disposition {
  const ids = widgetIds(response.widgets);
  return {
    widgets: response.widgets.map((widget, index) => ({
      ...widget,
      id: ids[index] ?? widget.source,
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
        body: {
          ...(preset === undefined ? {} : { preset }),
          widgets: widgets.map(serializeWidget),
        },
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

const point = z.object({ id: z.string(), label: z.string(), value: z.number() });
const serie = z.array(point);
const donneesCalcul = z.discriminatedUnion('forme', [
  z.object({
    forme: z.literal('scalaire'),
    donnee: z.object({
      libelle: z.string(),
      valeur: z.number(),
      affichage: z.string().exactOptional(),
    }),
  }),
  z.object({ forme: z.literal('classement'), donnee: serie }),
  z.object({ forme: z.literal('serie-temporelle'), donnee: serie }),
  z.object({
    forme: z.literal('composition'),
    donnee: z.array(z.object({ ligne: z.string(), segments: serie })),
  }),
]);

// `donnee` est `unknown` dans le contrat : rien ne s'affiche sans avoir été relu.
function rendreCalcul(resultat: Schemas['DonneesCalcul']): CalculRendu {
  const base = {
    titre: resultat.titre,
    ...(resultat.explication === undefined ? {} : { explication: resultat.explication }),
  };
  if (resultat.erreur !== undefined) return { ...base, erreur: resultat.erreur };
  const lu = donneesCalcul.safeParse({ forme: resultat.forme, donnee: resultat.donnee });
  if (!lu.success) return { ...base, erreur: 'Le calcul a rendu des données illisibles.' };
  return { ...base, donnees: lu.data };
}

export async function fetchCalculs(
  calculs: readonly Calcul[],
  plage: { du: string; au: string },
): Promise<CalculRendu[]> {
  if (calculs.length === 0) return [];
  const { resultats } = unwrap(
    await getApiClient().POST('/api/v1/tableaux-de-bord/calculs', {
      body: { du: plage.du, au: plage.au, calculs: [...calculs] },
    }),
  );
  return resultats.map(rendreCalcul);
}

export async function construireIndicateur(
  ecran: DashboardEcran,
  demande: string,
  catalogue: EntreeCatalogueApi[],
  proposition: Proposition | undefined,
): Promise<ReponseConstructeur> {
  return unwrap(
    await getApiClient().POST('/api/v1/tableaux-de-bord/{ecran}/construire', {
      params: { path: { ecran } },
      body:
        proposition === undefined ? { demande, catalogue } : { demande, catalogue, proposition },
    }),
  );
}

export async function fetchAmorces(): Promise<Amorce[]> {
  return unwrap(await getApiClient().GET('/api/v1/tableaux-de-bord/amorces')).amorces;
}
