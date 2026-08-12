import { randomBytes, createHash } from 'node:crypto';

/**
 * Tirage et répartition d'une campagne d'appels.
 *
 * Deux propriétés doivent tenir ensemble, et elles tirent dans des directions
 * opposées :
 *
 * 1. Le tirage est ALÉATOIRE. Distribuer la base dans l'ordre d'insertion
 *    donnerait à un commercial tous les prospects d'une même journée de saisie,
 *    donc d'un même quartier, d'un même établissement : les taux de réponse ne
 *    seraient plus comparables entre commerciaux.
 *
 * 2. Le tirage est REJOUABLE. Un litige sur une répartition doit pouvoir être
 *    tranché en rejouant le tirage, pas en croyant le serveur sur parole.
 *
 * D'où une graine persistée sur la campagne. Le mélange lui-même est fait par
 * PostgreSQL (`setseed` puis `ORDER BY random()`), pas en JavaScript : c'est la
 * base qui détient l'ensemble éligible, et le faire remonter pour le mélanger
 * puis le redescendre n'apporterait rien qu'un aller-retour.
 *
 * La graine ne sert QU'À l'audit et au rejeu. Les affectations sont
 * matérialisées en lignes `CallTask` dès la création : consulter une campagne
 * ou retélécharger un PDF ne retire jamais au sort. Un tirage paresseux
 * changerait la répartition dès qu'un prospect entre ou sort de l'ensemble
 * éligible — et le papier déjà distribué ne correspondrait plus à l'écran.
 */

/** Longueur en octets de la graine persistée. */
const SEED_BYTES = 16;

/** Graine de campagne : 32 caractères hexadécimaux, stockés tels quels. */
export function newCampaignSeed(): string {
  return randomBytes(SEED_BYTES).toString('hex');
}

/**
 * Traduit la graine persistée en argument de `setseed`, qui exige un double
 * dans [-1, 1].
 *
 * Le passage par un condensat plutôt que par une lecture directe des octets
 * rend la fonction insensible au FORMAT de la graine : si celui-ci changeait un
 * jour (base 64, UUID…), les graines déjà en base continueraient de donner le
 * même tirage tant que cette fonction ne change pas.
 */
export function toPostgresSeed(seed: string): number {
  const digest = createHash('sha256').update(seed, 'utf8').digest();
  // 48 bits : largement au-delà de la précision utile de setseed, et sans
  // risque de dépasser l'entier sûr de JavaScript.
  const value = digest.readUIntBE(0, 6);
  const unit = value / 2 ** 48; // [0, 1)
  return unit * 2 - 1; // [-1, 1)
}

export interface Assignment<T> {
  readonly item: T;
  /** Index du commercial dans la liste ordonnée par `position`. */
  readonly bucket: number;
  /** Rang de la ligne DANS le programme de ce commercial, à partir de 1. */
  readonly position: number;
}

/**
 * Répartition en tourniquet.
 *
 * En tourniquet et non par tranches contiguës : une découpe en tranches
 * donnerait au dernier commercial le reliquat, et surtout ferait dépendre
 * chaque lot d'une position dans la liste mélangée — un biais invisible mais
 * réel si l'ordre de mélange corrèle avec quoi que ce soit. Le tourniquet
 * garantit en prime, sans arithmétique particulière, que l'écart entre le lot
 * le plus gros et le plus petit ne dépasse JAMAIS une ligne.
 */
export function distributeRoundRobin<T>(items: readonly T[], bucketCount: number): Assignment<T>[] {
  if (bucketCount < 1) throw new Error('distributeRoundRobin: bucketCount doit valoir au moins 1');

  return items.map((item, index) => ({
    item,
    bucket: index % bucketCount,
    position: Math.floor(index / bucketCount) + 1,
  }));
}
