import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@crm/database';

import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../decorators/current-user.decorator.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Sur une route qui exige un RÔLE, l'autorité est relue en base.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT, ET IL DÉPASSE DE LOIN LA ROUTE QUI L'A RÉVÉLÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le jeton d'accès PORTE le rôle (voir `AccessTokenPayload`). Il est signé,
 * donc infalsifiable, mais il est aussi FIGÉ : ce qu'il affirme est vrai au
 * moment de l'émission, et le reste jusqu'à son expiration, quinze minutes par
 * défaut. `RolesGuard` comparait `@Roles(...)` à cette affirmation figée.
 *
 * Conséquence : rétrograder un ADMIN ne lui retirait RIEN dans l'immédiat. Il
 * gardait l'autorité d'administrateur sur TOUTES les routes ADMIN du dépôt,
 * jusqu'à ce que son jeton expire de lui-même. Un administrateur que l'on
 * rétrograde en urgence, parce que son compte est compromis ou parce qu'il
 * vient de quitter l'entreprise, disposait donc encore d'un quart d'heure sur
 * la gestion des comptes, la purge de la base et l'export intégral. La
 * révocation des refresh tokens ne changeait rien à cette fenêtre : elle
 * empêche d'obtenir un NOUVEAU jeton, pas d'utiliser celui qu'on a déjà.
 *
 * Ce n'est pas un défaut de l'export intégral. C'est un défaut du contrôle
 * d'accès, et il est réparé ICI, une fois, pour les quarante-six routes qui
 * déclarent un rôle.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE LA RELECTURE CORRIGE, ET DANS QUEL SENS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La garde ne REFUSE pas sur un rôle différent : elle ÉCRASE `request.user`
 * avec ce que la base dit, et laisse `RolesGuard`, enregistré juste après,
 * trancher. Deux raisons, et la seconde est la plus importante :
 *
 *  - un ADMIN rétrogradé en COMMERCIAL qui appelle une route COMMERCIAL doit
 *    continuer de travailler, pas être déconnecté. Refuser sur « le rôle a
 *    changé » couperait sa session entière pour un changement qui, sur cette
 *    route-là, ne lui retire rien ;
 *  - ce qui est en aval lit `request.user.role`. Sur les routes concernées,
 *    corriger l'identité plutôt que d'en refuser une seule utilisation répare
 *    donc AUSSI ces lectures, sans code supplémentaire.
 *
 * Sur une route ADMIN, l'ancien administrateur reçoit donc le 403 ordinaire de
 * `RolesGuard`, « Rôle insuffisant », qui est exactement la vérité.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CETTE GARDE NE FAIT PAS, ET IL FAUT LE DIRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sur une route SANS `@Roles`, rien n'est relu, et `request.user.role` y reste
 * donc celui du jeton, périmé jusqu'à quinze minutes. C'est assumé, et ce n'est
 * pas un trou d'autorisation : ces routes n'accordent aucun droit d'après le
 * rôle, et ce qu'elles cloisonnent l'est par `id` en base, valeur que le jeton
 * ne peut pas périmer. Relire sur chacune d'elles ajouterait une requête à tout
 * le trafic du produit, la remontée mobile comprise, pour corriger une valeur
 * dont aucune décision ne dépend.
 *
 * Si un jour une route sans `@Roles` se met à DÉCIDER d'après le rôle, c'est
 * cette hypothèse-là qui tombe, et il faudra soit lui poser un `@Roles`, soit
 * élargir la relecture. Le test de cette garde épingle la limite pour qu'elle
 * se découvre ici, et non en production.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TROIS REFUS, EUX, SONT IMMÉDIATS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le compte SUPPRIMÉ, le compte DÉSACTIVÉ et la session de DÉMONSTRATION
 * survivante ne sont pas des questions de rôle : aucune valeur de `@Roles` ne
 * les rendrait acceptables, et il n'y a donc rien à déléguer. Ils rendent 401,
 * parce que c'est la session qui n'est plus valable et que le client doit
 * refaire une authentification, pas demander un droit.
 *
 * La troisième mérite son nom. Le compte `demo.admin@cpi.sn` est semé ADMIN,
 * avec un mot de passe publié dans ce dépôt. `AuthService` refuse désormais de
 * lui ÉMETTRE une session quand la démonstration est éteinte, mais un jeton
 * obtenu PENDANT la démonstration continuait de vivre quinze minutes après
 * l'extinction, avec l'autorité ADMIN, sur les données RÉELLES. La correction
 * précédente couvrait l'émission ; celle-ci couvre les jetons déjà émis, qui
 * sont précisément ceux qu'un visiteur de passage a pu emporter.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CELA COÛTE, ET POURQUOI SEULEMENT LÀ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une lecture par clé primaire, et UNIQUEMENT sur les routes qui déclarent
 * `@Roles(...)`. Une route sans décorateur, c'est-à-dire l'essentiel du trafic
 * (la remontée mobile, les listes, les tableaux de bord), ne paie rien : elle
 * n'affirme aucune autorité particulière, et le cloisonnement qui la protège
 * est fait en base sur `id`, pas sur le rôle porté par le jeton.
 *
 * L'état de la démonstration, lui, passe par le cache de deux secondes de
 * `DemoVisibilityService` : il n'ajoute pas un aller-retour par requête.
 *
 * Le doute REFUSE, comme à l'émission : `state()` rendant `unknown` sur une
 * session de démonstration fait 401. Refuser à tort coûte une reconnexion ;
 * accepter à tort laisse une session ADMIN de démonstration sur la production.
 */
@Injectable()
export class FreshSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    // Pas de rôle exigé, pas de relecture. C'est ce qui rend la garde gratuite
    // sur la quasi-totalité du trafic.
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    // Route publique portant tout de même un `@Roles`, ou transport sans
    // identité : `RolesGuard` refusera. Rien à rafraîchir.
    if (!user) return true;

    const fresh = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, isActive: true, isDemo: true, deletedAt: true },
    });

    if (!fresh || fresh.deletedAt !== null) {
      throw new UnauthorizedException({
        code: 'SESSION_REVOKED',
        message: 'Ce compte n’existe plus. Reconnectez-vous.',
      });
    }

    if (!fresh.isActive) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'Ce compte est désactivé. Contactez un administrateur.',
      });
    }

    if (fresh.isDemo && (await this.demo.state()) !== 'on') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message:
          'Ce compte n’existe que pour les démonstrations, et le mode démonstration est ' +
          'éteint. Connectez-vous avec un compte réel.',
      });
    }

    // L'écrasement, et c'est le cœur de la garde : à partir d'ici, le rôle qui
    // circule dans la requête est celui de la BASE, pas celui du jeton.
    request.user = { ...user, role: fresh.role };
    return true;
  }
}
