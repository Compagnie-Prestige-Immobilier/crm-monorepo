import { ForbiddenException } from '@nestjs/common';
import { ProspectStatut, RepresentantRelation, SuggestionStatus } from '@crm/database';

/**
 * Les transitions légales, écrites UNE fois et gardées côté serveur.
 *
 * Elles n'existaient que dans le navigateur : le panneau refusait de proposer
 * une bascule depuis un état terminal, mais l'API l'acceptait, donc le mobile
 * et un `curl` la faisaient passer. Une règle qui n'existe que côté client est
 * une règle qui n'existe pas.
 *
 * Réécrire un état À L'IDENTIQUE est toujours permis : c'est un rejeu de
 * synchronisation, pas une transition, et le refuser ferait échouer des lots
 * légitimes venus d'un téléphone hors ligne.
 */
type Transitions<T extends string> = Readonly<Record<T, readonly T[]>>;

/**
 * `CONVERTI` est terminal : il porte une `ProspectConversion` signée et datée.
 * `PERDU` ne l'est pas — une fiche perdue se retravaille, et c'est le geste
 * commercial le plus courant après une relance.
 */
export const PROSPECT_STATUT_TRANSITIONS: Transitions<ProspectStatut> = {
  [ProspectStatut.NOUVEAU]: [ProspectStatut.CONTACTE, ProspectStatut.PERDU],
  [ProspectStatut.CONTACTE]: [ProspectStatut.CONVERTI, ProspectStatut.PERDU],
  [ProspectStatut.PERDU]: [ProspectStatut.CONTACTE],
  [ProspectStatut.CONVERTI]: [],
};

/**
 * Le RANG ne baisse jamais, mais rien n'est figé à rang égal.
 *
 * `AMBASSADEUR` et `REFUS` sont au même rang côté panneau (`REP_RELATION_RANK`
 * les met tous deux à 2) et la bascule de l'un à l'autre est un geste métier
 * documenté : « un ambassadeur qui cesse redevient un refus ». Ce qui est
 * interdit, c'est de REVENIR en arrière — personne ne redevient inconnu, et un
 * représentant qui a tranché n'est plus « simplement contacté ».
 */
export const REPRESENTANT_RELATION_TRANSITIONS: Transitions<RepresentantRelation> = {
  [RepresentantRelation.INCONNU]: [
    RepresentantRelation.CONTACTE,
    RepresentantRelation.AMBASSADEUR,
    RepresentantRelation.REFUS,
  ],
  [RepresentantRelation.CONTACTE]: [RepresentantRelation.AMBASSADEUR, RepresentantRelation.REFUS],
  [RepresentantRelation.AMBASSADEUR]: [RepresentantRelation.REFUS],
  [RepresentantRelation.REFUS]: [RepresentantRelation.AMBASSADEUR],
};

/** Une piste soldée l'est : il n'y a pas de retour depuis « appelé » ou « abandonné ». */
export const SUGGESTION_STATUS_TRANSITIONS: Transitions<SuggestionStatus> = {
  [SuggestionStatus.A_APPELER]: [SuggestionStatus.APPELE, SuggestionStatus.ABANDONNE],
  [SuggestionStatus.APPELE]: [],
  [SuggestionStatus.ABANDONNE]: [],
};

export function isLegalTransition<T extends string>(
  transitions: Transitions<T>,
  from: T,
  to: T,
): boolean {
  if (from === to) return true;
  return transitions[from].includes(to);
}

/**
 * `bypass` : un ADMIN corrige une erreur de saisie, y compris depuis un état
 * terminal. Sans cette porte, une conversion enregistrée par erreur ne serait
 * plus jamais rattrapable autrement qu'en SQL direct.
 */
export function assertTransition<T extends string>(
  transitions: Transitions<T>,
  from: T,
  to: T,
  options: { code: string; label: string; bypass?: boolean },
): void {
  if (options.bypass === true) return;
  if (isLegalTransition(transitions, from, to)) return;
  throw new ForbiddenException({
    code: options.code,
    message: `${options.label} : le passage de « ${from} » à « ${to} » n’est pas permis.`,
  });
}
