/**
 * Bornes de filtre sur une date, interprétées à l'heure de Dakar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tous les filtres `dateFrom` / `dateTo` du produit sont documentés comme
 * INCLUS et validés par `@IsISO8601()`, qui accepte aussi bien un instant
 * complet (`2026-08-13T14:30:00Z`) qu'une date nue (`2026-08-13`). Or
 * `new Date('2026-08-13')` vaut MINUIT UTC, c'est à dire le tout début de la
 * journée. Comparée avec `<=`, cette borne exclut les 24 heures du 13 août.
 *
 * Conséquence concrète : tout chiffre filtré « jusqu'à aujourd'hui » perdait
 * la journée en cours. Un directeur qui ouvrait le tableau de bord à 17 h
 * voyait un total arrêté la veille au soir, sans que rien ne le signale, et
 * concluait à une journée blanche.
 *
 * On distingue donc deux cas :
 *
 *   - une DATE NUE est l'expression d'une journée entière. La borne basse est
 *     son premier instant, la borne haute son DERNIER instant.
 *   - un INSTANT complet est déjà une position précise sur l'axe du temps :
 *     on ne le déplace pas, l'appelant a dit ce qu'il voulait.
 *
 * La journée en question est celle de DAKAR, pas celle du serveur. Rien
 * n'impose que le conteneur tourne à l'heure du Sénégal, et un serveur
 * déployé ailleurs découperait les journées ailleurs, donc rangerait les
 * mêmes fiches dans des jours différents selon l'endroit du déploiement.
 *
 * Le décalage de Dakar est aujourd'hui nul (GMT toute l'année, sans heure
 * d'été), ce qui rend le calcul invisible. Il reste néanmoins calculé et non
 * supposé : une constante à zéro codée en dur serait indétectable le jour où
 * elle devient fausse.
 */

export const DAKAR_TIME_ZONE = 'Africa/Dakar';

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: DAKAR_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

type Field = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

/** Heure murale à Dakar d'un instant donné, champ par champ. */
export function dakarWallClock(date: Date): Record<Field, number> {
  const found = {} as Record<Field, number>;
  for (const part of PARTS.formatToParts(date)) {
    if (part.type !== 'literal') found[part.type as Field] = Number(part.value);
  }
  return found;
}

/**
 * Décalage de Dakar, en millisecondes, à l'instant donné.
 *
 * Mesuré et non supposé : on lit l'heure murale de l'instant, on la relit
 * comme si elle était UTC, et l'écart entre les deux EST le décalage.
 *
 * La comparaison se fait à la SECONDE PLEINE des deux côtés. `Intl` ne rend
 * pas les millisecondes : les garder à gauche et les perdre à droite ferait
 * apparaître un décalage fantôme égal à la partie sous-seconde de l'instant
 * sondé, et une borne de fin de journée à .999 basculerait au lendemain.
 */
function dakarOffsetMs(instant: Date): number {
  const { year, month, day, hour, minute, second } = dakarWallClock(instant);
  const wallSeconds = Date.UTC(year, month - 1, day, hour, minute, second);
  const instantSeconds = Math.floor(instant.getTime() / 1000) * 1000;
  return wallSeconds - instantSeconds;
}

/** Une date nue, sans heure : `2026-08-13`. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Instant correspondant à une heure murale de Dakar.
 *
 * Le décalage se calcule sur une PREMIÈRE approximation de l'instant, puis on
 * corrige. Sur un fuseau à décalage fixe la correction est exacte du premier
 * coup ; l'écriture reste juste si Dakar adoptait un jour une heure d'été.
 */
function fromDakarWallClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  return new Date(guess - dakarOffsetMs(new Date(guess)));
}

/**
 * Borne BASSE incluse.
 *
 * Une date nue devient le premier instant de la journée à Dakar. Un instant
 * complet est rendu tel quel.
 */
export function inclusiveDateFrom(iso: string): Date {
  const match = DATE_ONLY.exec(iso);
  if (!match) return new Date(iso);
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return fromDakarWallClock(year, month, day, 0, 0, 0, 0);
}

/**
 * Borne HAUTE incluse.
 *
 * Une date nue devient le DERNIER instant de la journée à Dakar, faute de quoi
 * la comparaison `<=` exclut la journée entière que l'utilisateur croyait
 * demander. Un instant complet est rendu tel quel.
 *
 * La milliseconde 999 suffit : les colonnes concernées sont en
 * `TIMESTAMP(3)`, donc à la milliseconde. Sur une colonne plus fine, il
 * faudrait passer à une comparaison stricte sur le lendemain.
 */
export function inclusiveDateTo(iso: string): Date {
  const match = DATE_ONLY.exec(iso);
  if (!match) return new Date(iso);
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return fromDakarWallClock(year, month, day, 23, 59, 59, 999);
}
