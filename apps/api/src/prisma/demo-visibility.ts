/**
 * Mode démonstration — visibilité, pas destruction.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE PRINCIPE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les lignes de démonstration coexistent EN PERMANENCE avec les vraies. Le
 * mode démo est une bascule d'AFFICHAGE : il les montre ou les cache. Rien
 * n'est jamais créé au moment de l'activation, rien n'est jamais supprimé au
 * moment de l'extinction.
 *
 * La conception précédente insérait à l'activation et supprimait à l'extinction.
 * Elle était sûre — un registre traçait chaque ligne créée — mais elle laissait
 * un défaut plus grave que celui qu'elle évitait : **tant que le mode était
 * actif, les fiches de démonstration étaient dans les mêmes tables que les
 * vraies, et sortaient donc dans un export Excel transmis au siège.**
 *
 * Avec un filtre, cette fuite devient impossible : mode éteint, la ligne de
 * démonstration n'existe pour aucune lecture, export compris.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UN HELPER EXPLICITE ET PAS UNE EXTENSION PRISMA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Même raison que `not-deleted.ts` : une extension cache la règle dans une
 * couche que le lecteur du service ne voit pas, et `$queryRaw` la contourne de
 * toute façon. Ici la règle est un fragment composé dans chaque `where`, et un
 * test de balayage vérifie qu'aucun service ne l'oublie.
 */

/**
 * Fragment `where` selon l'état du mode démonstration.
 *
 * - mode ÉTEINT  → `{ isDemo: false }` : seules les vraies lignes sont visibles.
 * - mode ALLUMÉ  → `{}` : tout est visible, réel et démonstration mêlés.
 *
 * Le sens de la condition compte : on filtre quand le mode est ÉTEINT, pas
 * quand il est allumé. L'état par défaut d'une plateforme est « pas de
 * démonstration », et c'est cet état-là qui doit être protégé.
 */
export const demoScope = (demoEnabled: boolean): { isDemo?: false } =>
  demoEnabled ? {} : { isDemo: false };

/** Compose `demoScope` avec le reste d'un filtre. */
export const withDemoScope = <T extends object>(
  where: T | undefined,
  demoEnabled: boolean,
): T & { isDemo?: false } => ({
  ...(where ?? ({} as T)),
  ...demoScope(demoEnabled),
});

/**
 * Fragment SQL équivalent, pour les agrégats écrits en SQL brut.
 *
 * Renvoie `TRUE` plutôt qu'une chaîne vide quand le mode est allumé : le
 * fragment se compose ainsi sans condition dans un `WHERE ... AND ...`, et un
 * appelant ne peut pas produire de SQL bancal en l'insérant tel quel.
 */
export const demoScopeSql = (demoEnabled: boolean): string =>
  demoEnabled ? 'TRUE' : '"isDemo" = FALSE';
