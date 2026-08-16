import { ImportStatus } from '@crm/database';

import type { ImportRowError } from './import-adapter.js';

/**
 * L'état d'un import de masse, et les règles qui le font vieillir.
 *
 * Tout est écrit ici, en fonctions PURES, séparément du moteur : ce sont ces
 * règles-là qui décident si un travail est repris, abandonné ou refusé, et
 * elles doivent pouvoir être exercées sans base, sans classeur et sans horloge
 * réelle. Même partage que `db-dump.job.ts`, dont ce fichier reprend la forme.
 */

/**
 * Première ligne de données d'un classeur d'import.
 *
 * Ligne 1 : l'en-tête. Ligne 2 : l'exemple grisé écrit par le générateur de
 * modèle. Ligne 3 : la première fiche réelle.
 *
 * L'EXEMPLE N'EST JAMAIS LU, et c'est un correctif, pas un confort : un
 * classeur rempli sans supprimer la ligne d'exemple créait sinon une fiche
 * « Fatou Ndiaye » au 77 123 45 67, qui prenait le numéro d'exemple dans
 * l'index d'unicité et le rendait indisponible à toute vraie fiche. Reprise
 * telle quelle de `representants-import.service.ts`, où le test
 * « l'exemple du modèle n'est jamais importé » la tient.
 */
export const FIRST_DATA_ROW = 3;

/**
 * Nombre d'erreurs détaillées portées par le rapport.
 *
 * Au-delà, la liste cesse d'être lisible, et le rapport cesse d'être une valeur
 * `Json` raisonnable à stocker : cinquante mille erreurs dans une colonne
 * `jsonb` pèsent plusieurs mégaoctets, relus à chaque affichage de la liste des
 * travaux. Les compteurs, eux, restent EXACTS : `errorRows` compte tout, la
 * liste n'en montre que le début.
 */
export const MAX_REPORTED_ERRORS = 200;

/**
 * Durée du BAIL posé sur un travail pris en charge.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PLANCHER : COUVRIR LA TRANCHE LA PLUS LENTE QUI SOIT LÉGITIME
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reprendre un travail dont le processus tourne encore ferait relire le
 * classeur depuis `processedRows` pendant que l'autre écrit toujours. Le jeton
 * de fencing rend cette double exécution INOFFENSIVE (celui qui a perdu le bail
 * n'écrit plus rien, voir `import-claim.ts`), mais elle reste du travail
 * gâché. Une tranche de cinq cents lignes se compte en secondes ; dix minutes
 * sont deux ordres de grandeur au-dessus.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PLAFOND : NE PAS FIGER UN TRAVAIL MORT PLUS LONGTEMPS QU'IL NE FAUT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'état vit en base, le processus vit dans le conteneur : un redéploiement au
 * milieu d'un import laisse une ligne `running` que plus rien ne fera avancer.
 * Sans cette borne, elle resterait telle quelle POUR TOUJOURS, et l'écran
 * afficherait indéfiniment une barre de progression figée à 38 %.
 *
 * Le bail est RENOUVELÉ à chaque tranche (voir `ImportClaim.renew`) : il n'a
 * donc pas à couvrir la durée totale d'un import de cinquante mille lignes,
 * seulement l'intervalle entre deux tranches.
 */
export const IMPORT_LEASE_MS = 10 * 60_000;

/**
 * Écart d'horloge TOLÉRÉ sur l'horodatage d'un travail en cours.
 *
 * Un travail qui aurait été revendiqué DEVANT l'horloge n'existe pas dans un
 * monde sain. Deux causes le produisent pourtant, et tout tient à les séparer :
 * le petit ajustement NTP, banal, qu'il serait absurde de traiter comme une
 * panne ; et le SAUT EN ARRIÈRE (conteneur démarré avant synchronisation,
 * machine restaurée depuis un instantané), qui rend l'âge du travail NÉGATIF,
 * donc jamais supérieur au bail, donc le travail éternel.
 *
 * Même arbitrage, même chiffre et même raison que
 * `DUMP_CLOCK_SKEW_TOLERANCE_MS` : ce n'est pas une durée d'exécution, c'est la
 * largeur du doute qu'on accorde à l'horloge.
 */
export const IMPORT_CLOCK_SKEW_TOLERANCE_MS = 5 * 60_000;

/** Les états d'un travail encore en vol. Voir plus bas pourquoi `queued` en est. */
export const isInFlight = (status: ImportStatus): boolean =>
  status === ImportStatus.queued || status === ImportStatus.running;

/** Le strict nécessaire pour juger de l'âge d'un travail. */
export interface ImportLeaseView {
  readonly status: ImportStatus;
  readonly claimedAt: Date | null;
  readonly createdAt: Date;
}

/**
 * Le travail est-il REPRENABLE, horloge en main ?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI `queued` COMPTE AUTANT QUE `running`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La tentation est d'écrire « un `queued` est par définition libre, il n'a pas
 * de bail ». C'est faux dès qu'on regarde la fenêtre entre la revendication et
 * l'écriture de `running` : un conteneur qui meurt DEDANS laisse une ligne
 * `queued` PORTANT DÉJÀ un `claimToken`. Le balayage suivant la verrait libre,
 * la reprendrait, et deux travailleurs liraient le même classeur.
 *
 * Un `queued` est donc reprenable exactement quand il n'a jamais été revendiqué
 * (`claimedAt` nul), ou quand son bail a expiré comme n'importe quel autre.
 * C'est le motif que `db-dump.job.ts` a dû corriger après coup, et il est
 * repris d'emblée : la fenêtre est étroite, donc jamais observée en recette, et
 * définitive quand elle survient.
 */
export function isClaimable(job: ImportLeaseView, now: Date): boolean {
  if (!isInFlight(job.status)) return false;
  if (job.claimedAt === null) return true;

  const age = now.getTime() - job.claimedAt.getTime();

  // Un horodatage illisible est un travail MORT, et le sens du doute est celui
  // de la reprise : reprendre à tort coûte du travail refait, que le jeton de
  // fencing rend inoffensif ; ne jamais reprendre coûte le travail entier.
  if (!Number.isFinite(age)) return true;

  if (age > IMPORT_LEASE_MS) return true;

  // L'horloge a reculé : l'âge ne franchira plus jamais le bail, et la ligne
  // serait éternelle. Voir `IMPORT_CLOCK_SKEW_TOLERANCE_MS`.
  return age < -IMPORT_CLOCK_SKEW_TOLERANCE_MS;
}

/**
 * Découpe une suite en tranches d'au plus `size`.
 *
 * Écrite ici, pure, et non en ligne dans le moteur : c'est la seule façon de
 * l'exercer sur les cas qui font mal, la suite vide, la suite plus courte
 * qu'une tranche, et surtout la suite dont la taille est un MULTIPLE EXACT de
 * la tranche, où une boucle mal bornée produit une tranche vide finale que la
 * transaction ouvre pour rien.
 */
export function chunkOf<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new RangeError('La taille de tranche doit être strictement positive.');
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

/**
 * Le nombre de lignes de données à SAUTER lors d'une reprise.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * C'EST TOUT LE MÉCANISME DE REPRISE, ET IL TIENT DANS UN INVARIANT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `processedRows` est avancé DANS LA MÊME TRANSACTION que l'écriture de la
 * tranche (voir le moteur). Il n'existe donc aucun instant où des lignes sont
 * écrites sans être comptées, ni comptées sans être écrites : soit la
 * transaction a été validée et les deux sont vrais, soit elle a été annulée et
 * aucun des deux ne l'est.
 *
 * Une reprise saute exactement `processedRows` lignes de données. Elle ne
 * recrée donc RIEN, et n'en oublie aucune non plus.
 */
export const resumeSkip = (processedRows: number): number =>
  Number.isFinite(processedRows) && processedRows > 0 ? Math.floor(processedRows) : 0;

/**
 * Le plafond de lignes est-il déjà franchi ?
 *
 * Appelé DEUX fois, et les deux comptent :
 *
 *  · sur le nombre de lignes DÉCLARÉ PAR L'EN-TÊTE de la feuille, avant d'avoir
 *    lu la moindre cellule. C'est le refus qui ne coûte rien : un classeur de
 *    deux millions de lignes est écarté sans qu'une seule ligne n'ait été
 *    matérialisée ;
 *  · sur le compteur de lignes réellement lues, parce que l'en-tête MENT dès
 *    qu'un tableur tiers a réenregistré le fichier sans écrire `<dimension>`.
 *    Sans ce second contrôle, le premier serait une politesse et non une borne.
 */
export const exceedsCeiling = (rows: number | null, maxRows: number): boolean =>
  rows !== null && Number.isFinite(rows) && rows > maxRows;

/**
 * Ajoute des erreurs à une liste BORNÉE, sans jamais la faire déborder.
 *
 * Rend la liste inchangée quand elle est pleine : c'est ce qui garantit que le
 * coût mémoire d'un import de cinquante mille lignes toutes fausses reste celui
 * de deux cents erreurs, et non celui de cinquante mille.
 */
export function boundErrors(
  current: readonly ImportRowError[],
  incoming: readonly ImportRowError[],
  max = MAX_REPORTED_ERRORS,
): ImportRowError[] {
  if (current.length >= max) return [...current];
  return [...current, ...incoming].slice(0, max);
}
