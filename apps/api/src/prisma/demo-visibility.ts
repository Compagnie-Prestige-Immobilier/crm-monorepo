/**
 * Le mode démonstration est une bascule d'AFFICHAGE : les lignes fictives
 * coexistent en permanence avec les vraies, rien n'est créé à l'allumage ni
 * supprimé à l'extinction. C'est ce qui empêche une fiche de démonstration de
 * sortir dans un export Excel transmis au siège.
 *
 * Fragment explicite et non extension Prisma, même raison que `not-deleted.ts` :
 * `$queryRaw` contournerait l'extension. Un test de balayage vérifie qu'aucun
 * service n'oublie le fragment.
 */

/** On filtre quand le mode est ÉTEINT : c'est l'état par défaut, celui à protéger. */
export const demoScope = (demoEnabled: boolean): { isDemo?: false } =>
  demoEnabled ? {} : { isDemo: false };

export const withDemoScope = <T extends object>(
  where: T | undefined,
  demoEnabled: boolean,
): T & { isDemo?: false } => ({
  ...(where ?? ({} as T)),
  ...demoScope(demoEnabled),
});

/** `TRUE` et non une chaîne vide, pour se composer sans condition dans un `WHERE ... AND`. */
export const demoScopeSql = (demoEnabled: boolean): string =>
  demoEnabled ? 'TRUE' : '"isDemo" = FALSE';
