/**
 * Normalisation de la référence bancaire.
 *
 * `reference` est la saisie de l'agent, affichée telle quelle sur le dossier ;
 * `referenceKey` est sa forme normalisée et c'est ELLE qui porte l'unicité
 * globale, adossée à l'index partiel `bank_cases_reference_key_active`.
 *
 * La règle est volontairement minimale, majuscules, espaces compactés, parce
 * qu'une normalisation agressive (retirer les tirets, les barres obliques)
 * fusionnerait des références que la banque considère distinctes. Deux agents
 * qui saisissent « bnk 2026-014 » et « BNK  2026-014 » désignent le même
 * dossier ; « BNK-2026-014 » et « BNK 2026 014 » ne sont pas notre affaire.
 */
export function normalizeReferenceKey(reference: string): string {
  return reference.trim().replace(/\s+/gu, ' ').toUpperCase();
}

/** Forme d'affichage : mêmes espaces compactés, casse de l'agent préservée. */
export function normalizeReferenceDisplay(reference: string): string {
  return reference.trim().replace(/\s+/gu, ' ');
}
