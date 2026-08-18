import { randomBytes, createHash } from 'node:crypto';
import type { Prisma } from '@crm/database';

// La graine persistée trace le tirage à version de PostgreSQL égale : `setseed`
// a déjà changé de générateur en 15, un rejeu opposable exigerait de persister
// la liste ordonnée des identifiants tirés.

const SEED_BYTES = 16;

export function newCampaignSeed(): string {
  return randomBytes(SEED_BYTES).toString('hex');
}

// Le condensat rend le tirage insensible au format de la graine : changer
// celui-ci ne changerait pas les tirages des graines déjà en base.
export function toPostgresSeed(seed: string): number {
  const digest = createHash('sha256').update(seed, 'utf8').digest();
  const value = digest.readUIntBE(0, 6);
  const unit = value / 2 ** 48;
  return unit * 2 - 1;
}

export interface Assignment<T> {
  readonly item: T;
  /** Index du commercial dans la liste ordonnée par `position`. */
  readonly bucket: number;
  /** Rang de la ligne DANS le programme de ce commercial, à partir de 1. */
  readonly position: number;
}

// Tourniquet et non tranches contiguës : une tranche ferait dépendre le lot de
// la position dans la liste mélangée, le tourniquet borne l'écart à une ligne.
export function distributeRoundRobin<T>(items: readonly T[], bucketCount: number): Assignment<T>[] {
  if (bucketCount < 1) throw new Error('distributeRoundRobin: bucketCount doit valoir au moins 1');

  return items.map((item, index) => ({
    item,
    bucket: index % bucketCount,
    position: Math.floor(index / bucketCount) + 1,
  }));
}

// Reprises telles quelles par la contrainte CHECK de la base.
export const MIN_SPREAD_DAYS = 1;
export const MAX_SPREAD_DAYS = 31;

// Tranches contiguës ici, à l'inverse du tourniquet : le rang dans la file d'un
// commercial est déjà l'ordre d'appel, un tourniquet mêlerait les journées.
export function dayIndexFor(position: number, count: number, days: number): number {
  if (days <= 1 || count <= 0) return 0;
  const effective = Math.min(days, count);
  return Math.min(effective - 1, Math.floor(((position - 1) * effective) / count));
}

// Toujours `days` cases, journées vides comprises : l'aperçu et le détail
// publient `perDay` sous le même nom, une longueur variable déformerait le
// graphique sans qu'aucune donnée n'ait bougé.
export function dayHistogram(count: number, days: number): number[] {
  const buckets = Array.from({ length: Math.max(1, days) }, () => 0);
  for (let position = 1; position <= count; position += 1) {
    const index = dayIndexFor(position, count, days);
    buckets[index] = (buckets[index] ?? 0) + 1;
  }
  return buckets;
}

// `setseed` fixe la suite pseudo-aléatoire de la SESSION : les deux
// instructions doivent partager la connexion de la transaction interactive.
// La liste transite en un seul paramètre JSON, PostgreSQL refusant au-delà de
// 65 535 paramètres liés.
export async function shuffleInPostgres(
  tx: Prisma.TransactionClient,
  seed: string,
  ids: readonly string[],
): Promise<string[]> {
  await tx.$executeRawUnsafe('SELECT 1 FROM (SELECT setseed($1)) AS seeded', toPostgresSeed(seed));

  const rows = await tx.$queryRawUnsafe<{ id: string }[]>(
    'SELECT value AS id FROM jsonb_array_elements_text($1::jsonb) AS value ORDER BY random()',
    JSON.stringify(ids),
  );

  /* c8 ignore next 3 -- une perte de ligne amputerait la campagne en silence. */
  if (rows.length !== ids.length) {
    throw new Error('Mélange incohérent : le nombre de lignes a changé pendant le tirage.');
  }

  return rows.map((row) => row.id);
}
