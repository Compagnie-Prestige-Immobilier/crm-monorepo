/**
 * Provenances qu'une fiche peut porter.
 *
 * La liste n'est pas décorative : la base porte la contrainte
 * `prospects_origin_known`, qui n'accepte que NULL ou « BANQUE ». Une valeur
 * hors liste ne produirait donc pas un filtre vide mais, du côté des écritures,
 * une violation de contrainte remontée en 500 sans rien qui l'explique. La
 * valider ICI transforme la faute en 400 lisible, à l'endroit où l'appelant
 * peut encore la corriger.
 *
 * Une fiche SANS provenance n'a rien d'anormal : c'est le chemin normal, la
 * tournée terrain, où `createdById` dit déjà tout. Absent de cette liste, donc,
 * et volontairement.
 *
 * Ajouter un canal ici exige la migration qui étend la contrainte, dans le même
 * changement : c'est le prix de ne jamais avoir deux vocabulaires.
 */
export const PROSPECT_ORIGINS = ['BANQUE'] as const;

export type ProspectOrigin = (typeof PROSPECT_ORIGINS)[number];
