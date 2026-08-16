import type { BddSegment } from '@/lib/types';

/**
 * Le croisement syndicat × banque, RECOPIÉ pour l'aperçu du panel.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UNE COPIE, ALORS QUE LE DÉPÔT INTERDIT LA SECONDE DÉFINITION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `packages/database/src/segment.ts` est la définition de référence, et le
 * panel ne peut pas l'importer : il ne dépend que de `@crm/api-client`, engendré
 * depuis le contrat, jamais du paquet base de données. C'est la même contrainte
 * qui a fait recopier `SEGMENT_LABELS` dans `lib/types.ts`.
 *
 * CE QUE CETTE COPIE PEUT ET NE PEUT PAS CASSER. Elle ne sert QU'À MONTRER le
 * segment d'arrivée avant la confirmation. Le segment réellement écrit dans
 * `SegmentChange` est calculé par le serveur, avec la définition de référence,
 * des deux côtés de la bascule. Une divergence afficherait donc un aperçu faux
 * — ce qui est déjà grave, un utilisateur validerait une conversion qu'il n'a
 * pas voulue — mais ne pourrait jamais écrire une histoire fausse.
 *
 * Les deux constantes portent les mêmes valeurs que le paquet partagé, et le
 * test voisin les épingle sur `SEGMENT_LABELS`, qui les nomme en toutes lettres.
 */

/** Sigle du syndicat qui définit l'axe « CHUES ». */
export const CHUES_SIGLE = 'CHUES';

/** Nom COURT de la banque qui définit l'axe « CBAO ». Jamais son nom complet. */
export const CBAO_SHORT_NAME = 'CBAO';

export function classifySegment(input: {
  syndicatSigle: string;
  banqueShortName: string;
}): BddSegment {
  const isChues = input.syndicatSigle === CHUES_SIGLE;
  const isCbao = input.banqueShortName === CBAO_SHORT_NAME;

  if (isChues) return isCbao ? 'BDD1' : 'BDD2';
  return isCbao ? 'BDD3' : 'BDD4';
}
