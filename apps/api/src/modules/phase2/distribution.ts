import { randomBytes, createHash } from 'node:crypto';
import type { Prisma } from '@crm/database';

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
 * 2. Le tirage est TRAÇABLE. Un litige sur une répartition doit pouvoir être
 *    instruit avec autre chose que la parole du serveur.
 *
 * D'où une graine persistée sur la campagne. Le mélange lui-même est fait par
 * PostgreSQL (`setseed` puis `ORDER BY random()`), pas en JavaScript : c'est la
 * base qui détient l'ensemble éligible, et le faire remonter pour le mélanger
 * puis le redescendre n'apporterait rien qu'un aller-retour.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE LA GRAINE GARANTIT, ET CE QU'ELLE NE GARANTIT PAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * TRAÇABILITÉ, pas rejeu certifié. La reproductibilité de `setseed` suivi de
 * `ORDER BY random()` dépend du générateur pseudo-aléatoire de PostgreSQL, qui
 * A DÉJÀ CHANGÉ une fois (PostgreSQL 15 a remplacé la fonction sous-jacente).
 * Une montée de version majeure peut donc, sans rien casser de visible,
 * produire une AUTRE permutation à partir de la même graine. Promettre un
 * « rejeu à l'identique » serait promettre quelque chose que la base ne
 * s'engage pas à tenir.
 *
 * Ce que la graine tient réellement : elle prouve que la répartition n'a pas
 * été choisie à la main, elle est constante à version de base égale, et elle
 * documente l'entrée du tirage. Pour un rejeu opposable à un tiers, il
 * faudrait aussi persister la LISTE ORDONNÉE des identifiants tirés, ce qui
 * n'est pas fait aujourd'hui.
 *
 * La graine ne sert donc qu'à cela. Les affectations, elles, sont
 * matérialisées en lignes `CallTask` dès la création : consulter une campagne
 * ou retélécharger un PDF ne retire jamais au sort. Un tirage paresseux
 * changerait la répartition dès qu'un prospect entre ou sort de l'ensemble
 * éligible, et le papier déjà distribué ne correspondrait plus à l'écran.
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
 * chaque lot d'une position dans la liste mélangée, un biais invisible mais
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

/** Bornes d'étalement admises. Reprises telles quelles par la contrainte CHECK. */
export const MIN_SPREAD_DAYS = 1;
export const MAX_SPREAD_DAYS = 31;

/**
 * Journée d'étalement d'une ligne, à partir de 0.
 *
 * ─── EN TRANCHES CONTIGUËS, ET C'EST VOULU ─────────────────────────────────
 *
 * Le tourniquet ci-dessus refuse délibérément les tranches contiguës, pour ne
 * pas faire dépendre le lot d'un commercial de sa position dans la liste
 * mélangée. Ici la logique s'inverse : le découpage porte sur une file DÉJÀ
 * attribuée à une seule personne, et le rang à l'intérieur de cette file est
 * précisément l'ordre dans lequel elle doit appeler. Un second tourniquet
 * mêlerait les journées et le programme du jour 3 ne suivrait plus celui du
 * jour 2.
 *
 * La répartition est au plus près : `count = 10`, `days = 3` donne 4, 3, 3, et
 * jamais 3, 3, 4 suivi d'un reliquat. Elle ne dépend que de (position, count,
 * days), donc à graine égale elle rejoue à l'identique.
 *
 * @param position rang dans la file du commercial, à partir de 1
 * @param count    taille de la file de ce commercial
 * @param days     nombre de journées demandé
 */
export function dayIndexFor(position: number, count: number, days: number): number {
  if (days <= 1 || count <= 0) return 0;
  const effective = Math.min(days, count);
  // Le zéro-based `position - 1` multiplié par le nombre de journées puis
  // divisé par la taille de la file distribue le reste sur les premières
  // journées, sans arithmétique de reliquat à écrire à la main.
  return Math.min(effective - 1, Math.floor(((position - 1) * effective) / count));
}

/**
 * Nombre de lignes par journée, pour l'aperçu de création.
 *
 * LE TABLEAU FAIT TOUJOURS `days` CASES, journées vides comprises.
 *
 * La répartition, elle, ne remplit que `min(days, count)` journées : dix
 * lignes sur trente jours tiennent en dix journées, `dayIndexFor` ne produit
 * pas d'indice au-delà. Mais l'aperçu et le détail d'une campagne publient
 * tous deux un champ `perDay`, et le détail rend `spreadDays` cases. Rendre
 * ici un tableau plus court faisait changer de LONGUEUR une série publiée sous
 * le même nom : un graphique tracé depuis l'aperçu puis redessiné depuis le
 * détail changeait de forme sans qu'aucune donnée n'ait bougé.
 *
 * Les journées excédentaires sortent donc à zéro, ce qui est la vérité : elles
 * existent dans la campagne et n'ont rien à appeler.
 */
export function dayHistogram(count: number, days: number): number[] {
  const buckets = Array.from({ length: Math.max(1, days) }, () => 0);
  for (let position = 1; position <= count; position += 1) {
    const index = dayIndexFor(position, count, days);
    buckets[index] = (buckets[index] ?? 0) + 1;
  }
  return buckets;
}

/**
 * Mélange déterministe, EXÉCUTÉ PAR POSTGRESQL.
 *
 * `setseed` fixe la suite pseudo-aléatoire de la SESSION ; les deux
 * instructions doivent donc partager la même connexion, ce que garantit la
 * transaction interactive.
 *
 * Écrit UNE fois ici, et non recopié dans chaque service de campagne : les
 * deux copies précédentes étaient identiques au caractère près, et une
 * correction appliquée à l'une seulement aurait fait diverger deux tirages que
 * l'on croit régis par la même règle.
 *
 * Sur la portée exacte de la garantie apportée par la graine, voir l'en-tête
 * de ce fichier : traçabilité à version de PostgreSQL égale, pas rejeu
 * opposable.
 *
 * La liste transite en un unique paramètre JSON plutôt qu'en autant de
 * paramètres liés : au-delà de 65 535 paramètres, PostgreSQL refuse la requête,
 * et une campagne peut porter dix fois ce nombre de lignes.
 */
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

  /* c8 ignore next 3 -- filet de sécurité : une perte de ligne ici passerait
     inaperçue et amputerait silencieusement la campagne. */
  if (rows.length !== ids.length) {
    throw new Error('Mélange incohérent : le nombre de lignes a changé pendant le tirage.');
  }

  return rows.map((row) => row.id);
}
