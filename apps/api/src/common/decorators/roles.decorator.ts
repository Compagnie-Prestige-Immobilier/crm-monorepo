import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import { Role } from '@crm/database';

export const ROLES_KEY = 'roles';

/** Restreint une route à un ou plusieurs rôles. Sans décorateur : tout utilisateur authentifié. */
export const Roles = (...roles: Role[]): CustomDecorator => SetMetadata(ROLES_KEY, roles);

/**
 * TOUS LES RÔLES, ÉCRIT PLUTÔT QUE SOUS-ENTENDU.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI DÉCLARER CE QUE L'ABSENCE DE DÉCORATEUR FAIT DÉJÀ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `RolesGuard` laisse passer toute identité authentifiée quand aucun rôle
 * n'est exigé. Une route ouverte à tous et une route dont l'auteur a OUBLIÉ de
 * dire qui pouvait l'appeler sont donc, dans le code, exactement le même
 * fichier : rien ne les distingue, ni à la lecture, ni à la revue, ni pour un
 * test.
 *
 * C'est cette confusion-là qui a laissé `export.controller.ts` et
 * `prospects.controller.ts` ouverts au pôle banque et financement, sur des
 * classeurs et des fiches de prospection dont le panneau web lui refuse déjà
 * l'écran. Personne n'avait décidé de les ouvrir ; personne n'avait décidé de
 * les fermer non plus, et c'est le second silence qui a gagné.
 *
 * Une route qui porte ces trois rôles dit « j'ai réfléchi, et c'est ouvert ».
 * Une route qui ne porte rien dit « personne n'a réfléchi », et
 * `authorization.sweep.test.ts` la dénonce. La distinction ne coûte qu'une
 * ligne, et c'est la seule qui rende le balayage possible.
 *
 * L'idiome vient de `notifications.controller.ts`, qui l'avait inventé pour
 * rouvrir deux routes de boîte de réception sous un `@Roles(ADMIN)` de classe.
 * Il est remonté ici pour que tout le dépôt parle la même langue.
 */
export const ANY_AUTHENTICATED = [Role.ADMIN, Role.COMMERCIAL, Role.BANQUE_FINANCE] as const;
