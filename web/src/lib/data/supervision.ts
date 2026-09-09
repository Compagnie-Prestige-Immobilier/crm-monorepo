import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';
import type { ProjetApi } from '@/lib/types';

type Schemas = components['schemas'];

export type Activite = Schemas['ActiviteDesTeleconseillers'];
export type LigneActivite = Schemas['LigneDActivite'];
export type NoteDeRendement = Schemas['NoteDeRendement'];
export type Rendement = Schemas['RendementDunTeleconseiller'];
export type Granularite = NonNullable<Activite['granularity']>;
export type OuvertureFiche = Schemas['QualificationOuvertureFicheDTO'];
export type ComptageJour = Schemas['QualificationComptageJourDTO'];

/** Bornes en AAAA-MM-JJ, incluses, journée d'Africa/Dakar. */
export interface Periode {
  from: string;
  to: string;
}

export type Preset = 'today' | 'week' | 'last7' | 'custom';

export const PRESET_LABELS: Record<Preset, string> = {
  today: 'Aujourd’hui',
  week: 'Cette semaine',
  last7: '7 derniers jours',
  custom: 'Période libre',
};

// Africa/Dakar est à UTC+0 toute l'année : la date UTC EST la date de Dakar.
export function aujourdhui(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function decale(isoDate: string, jours: number): string {
  const at = new Date(`${isoDate}T00:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() + jours);
  return at.toISOString().slice(0, 10);
}

export function periodeDuPreset(preset: Exclude<Preset, 'custom'>, jour = aujourdhui()): Periode {
  if (preset === 'today') return { from: jour, to: jour };
  if (preset === 'last7') return { from: decale(jour, -6), to: jour };
  const jourSemaine = new Date(`${jour}T00:00:00.000Z`).getUTCDay();
  return { from: decale(jour, -((jourSemaine + 6) % 7)), to: jour };
}

export function cleActivite(
  periode: Periode,
  granularite: Granularite,
  projet: ProjetApi,
  creneau?: { start: string; end: string },
): readonly unknown[] {
  return ['supervision', 'activite', periode.from, periode.to, granularite, projet, creneau];
}

/** `projet` est obligatoire : omis, l'API compte les deux projets ensemble. */
export async function fetchActivite(input: {
  periode: Periode;
  granularite: Granularite;
  projet: ProjetApi;
  creneau?: { start: string; end: string };
}): Promise<Activite> {
  return unwrap(
    await apiClient.GET('/api/v1/supervision/activite', {
      params: {
        query: {
          actFrom: `${input.periode.from}T00:00:00.000Z`,
          actTo: `${input.periode.to}T23:59:59.999Z`,
          granularity: input.granularite,
          projet: input.projet,
          ...(input.creneau === undefined
            ? {}
            : { timeFrom: input.creneau.start, timeTo: input.creneau.end }),
        },
      },
    }),
  );
}

export async function fetchComptageOuvertures(periode: Periode): Promise<ComptageJour[]> {
  const reponse = unwrap(
    await apiClient.GET('/api/v1/ouvertures/comptage', {
      params: { query: { from: periode.from, to: periode.to } },
    }),
  );
  return reponse.items ?? [];
}

export async function fetchOuverturesOuvertes(): Promise<OuvertureFiche[]> {
  const reponse = unwrap(await apiClient.GET('/api/v1/ouvertures/ouvertes'));
  return reponse.items ?? [];
}

export async function libererOuverture(id: string): Promise<OuvertureFiche> {
  return unwrap(
    await apiClient.POST('/api/v1/ouvertures/{id}/liberation', { params: { path: { id } } }),
  );
}

export function secondesEcoulees(depuis: string, maintenant: number): number | null {
  const at = Date.parse(depuis);
  return Number.isNaN(at) ? null : Math.max(0, Math.round((maintenant - at) / 1000));
}
