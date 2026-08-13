import { Role } from '@crm/database';

/**
 * Le PREMIER administrateur — le compte d'amorçage.
 *
 * Il n'existe pas de colonne « compte d'amorçage » dans le schéma, et en ajouter
 * une supposerait une migration pour une information déjà présente : le seed
 * crée l'administrateur initial avant tout autre compte (voir
 * `packages/database/src/seed.ts`). Le premier ADMIN par date de création EST
 * donc le compte d'amorçage.
 *
 * Le départage se fait sur `id` et non sur un ordre arbitraire : les
 * identifiants sont des UUID v7, dont l'ordre lexicographique est l'ordre
 * temporel. Deux comptes créés dans la même milliseconde restent donc départagés
 * de façon stable, et non au gré du plan d'exécution de PostgreSQL.
 *
 * Les comptes supprimés logiquement sont écartés : un administrateur d'amorçage
 * révoqué ne doit pas emporter avec lui la capacité de purger la base.
 */

/** Ce que la recherche a besoin de lire. Volontairement minimal, pour être stubbable. */
export interface FirstAdminReader {
  findFirst(args: {
    where: { role: Role; deletedAt: null; isActive: true };
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }];
    select: { id: true; email: true; username: true };
  }): Promise<{ id: string; email: string; username: string } | null>;
}

export interface FirstAdmin {
  readonly id: string;
  readonly email: string;
  readonly username: string;
}

export function findFirstAdmin(users: FirstAdminReader): Promise<FirstAdmin | null> {
  return users.findFirst({
    where: { role: Role.ADMIN, deletedAt: null, isActive: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, email: true, username: true },
  });
}

/**
 * La confirmation attendue : l'administrateur ressaisit SON identifiant de
 * connexion, celui qu'il tape sur l'écran de connexion.
 *
 * Les deux identifiants sont acceptés parce que les deux ouvrent une session
 * (`AuthService.login` cherche sur `email` OU `username`). En exiger un seul
 * ferait échouer un administrateur qui se connecte habituellement avec l'autre,
 * sans qu'il comprenne pourquoi.
 *
 * La comparaison est insensible à la casse et aux espaces de bord, comme la
 * connexion. Elle ne l'est pas au contenu : c'est le geste de ressaisie qui
 * porte la confirmation, pas sa mise en forme.
 */
export function matchesConfirmation(admin: FirstAdmin, typed: string): boolean {
  const normalized = typed.trim().toLocaleLowerCase();
  if (normalized === '') return false;
  return (
    normalized === admin.email.trim().toLocaleLowerCase() ||
    normalized === admin.username.trim().toLocaleLowerCase()
  );
}
