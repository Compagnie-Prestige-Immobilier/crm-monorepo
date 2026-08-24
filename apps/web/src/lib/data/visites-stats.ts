import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';
import { z } from 'zod';

import { getApiClient } from '@/lib/api/browser';
import { csvRows } from '@/lib/csv';

export const MOIS_LABELS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

const bucketSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  count: z.number(),
});

const statsSchema = z.object({
  from: z.string(),
  to: z.string(),
  total: z.number(),
  parEntreprise: z.array(bucketSchema),
  parDirection: z.array(bucketSchema),
  parDestinataire: z.array(bucketSchema),
  parObjet: z.array(bucketSchema),
  parMois: z.array(z.object({ month: z.string(), count: z.number() })),
  parJour: z.array(z.object({ date: z.string(), count: z.number() })),
  sansDirection: z.number(),
  sansDestinataire: z.number(),
});

export type VisitesStats = z.infer<typeof statsSchema>;
export type AxeVisites = VisitesStats['parEntreprise'];

export interface VisitesPeriode {
  annee: number;
  /** `null` pour le cumul annuel. */
  mois: number | null;
}

const pad = (valeur: number): string => String(valeur).padStart(2, '0');

const dernierJour = (annee: number, mois: number): number =>
  new Date(Date.UTC(annee, mois, 0)).getUTCDate();

export function bornes(periode: VisitesPeriode): { from: string; to: string } {
  if (periode.mois === null) {
    return { from: `${String(periode.annee)}-01-01`, to: `${String(periode.annee)}-12-31` };
  }
  const mois = pad(periode.mois);
  return {
    from: `${String(periode.annee)}-${mois}-01`,
    to: `${String(periode.annee)}-${mois}-${pad(dernierJour(periode.annee, periode.mois))}`,
  };
}

export function periodeLabel(periode: VisitesPeriode): string {
  if (periode.mois === null) return `année ${String(periode.annee)}`;
  return `${MOIS_LABELS[periode.mois - 1] ?? ''} ${String(periode.annee)}`;
}

export function moisPrecedent(periode: VisitesPeriode): VisitesPeriode | null {
  if (periode.mois === null) return null;
  if (periode.mois === 1) return { annee: periode.annee - 1, mois: 12 };
  return { annee: periode.annee, mois: periode.mois - 1 };
}

export const visitesStatsKey = (periode: VisitesPeriode) =>
  ['visites', 'statistiques', periode.annee, periode.mois] as const;

export async function fetchVisitesStats(
  periode: VisitesPeriode,
  client: ApiClient = getApiClient(),
): Promise<VisitesStats> {
  const { from, to } = bornes(periode);
  const data = unwrap(
    await client.GET('/api/v1/visites/statistiques', { params: { query: { from, to } } }),
  );

  const parsed = statsSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Les statistiques de visites ne sont pas dans la forme attendue.');
  }
  return parsed.data;
}

export function serieJournaliere(
  annee: number,
  mois: number,
  releves: readonly { date: string; count: number }[],
): { jour: number; total: number }[] {
  const prefixe = `${String(annee)}-${pad(mois)}-`;
  const totaux = new Map(
    releves
      .filter((point) => point.date.startsWith(prefixe))
      .map((point) => [Number(point.date.slice(prefixe.length)), point.count]),
  );
  return Array.from({ length: dernierJour(annee, mois) }, (_, index) => ({
    jour: index + 1,
    total: totaux.get(index + 1) ?? 0,
  }));
}

export function serieMensuelle(
  annee: number,
  releves: readonly { month: string; count: number }[],
): { mois: number; label: string; total: number }[] {
  const prefixe = `${String(annee)}-`;
  const totaux = new Map(
    releves
      .filter((point) => point.month.startsWith(prefixe))
      .map((point) => [Number(point.month.slice(prefixe.length)), point.count]),
  );
  return MOIS_LABELS.map((label, index) => ({
    mois: index + 1,
    label,
    total: totaux.get(index + 1) ?? 0,
  }));
}

export function nonRenseigne(total: number, axe: AxeVisites): number {
  const somme = axe.reduce((cumul, ligne) => cumul + ligne.count, 0);
  return Math.max(0, total - somme);
}

function arrondi(valeur: number): number {
  return Math.round(valeur * 10) / 10;
}

export function partDe(part: number, total: number): number | null {
  if (total <= 0) return null;
  return arrondi((part / total) * 100);
}

export function evolution(total: number, precedent: number): number | null {
  if (precedent <= 0) return null;
  return arrondi(((total - precedent) / precedent) * 100);
}

export function visitesCsv(stats: VisitesStats, periode: VisitesPeriode): string {
  const rows: (string | number | null)[][] = [[`Visites de ${periodeLabel(periode)}`], []];

  const bloc = (titre: string, axe: AxeVisites, sansValeur: number): void => {
    rows.push([titre, 'Visites', 'Part']);
    for (const ligne of axe)
      rows.push([ligne.label, ligne.count, partDe(ligne.count, stats.total)]);
    rows.push(['Non renseigné', sansValeur, null]);
    rows.push([]);
  };

  bloc('Entreprise', stats.parEntreprise, nonRenseigne(stats.total, stats.parEntreprise));
  bloc('Destinataire', stats.parDestinataire, stats.sansDestinataire);
  bloc('Direction', stats.parDirection, stats.sansDirection);
  bloc('Objet de la visite', stats.parObjet, nonRenseigne(stats.total, stats.parObjet));

  rows.push(['Mois', 'Visites']);
  for (const point of serieMensuelle(periode.annee, stats.parMois)) {
    rows.push([point.label, point.total]);
  }
  rows.push([]);
  rows.push(['Total', stats.total]);

  return csvRows(rows);
}

export function visitesCsvFileName(periode: VisitesPeriode): string {
  if (periode.mois === null) return `cpi-visites-${String(periode.annee)}.csv`;
  return `cpi-visites-${String(periode.annee)}-${pad(periode.mois)}.csv`;
}
