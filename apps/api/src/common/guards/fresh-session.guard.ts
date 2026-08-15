import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import type { AuthenticatedUser } from '../decorators/current-user.decorator.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Sur TOUTE requête authentifiée, l'autorité est relue en base.
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
 * d'accès, et il est réparé ICI, une fois, pour TOUTE requête authentifiée.
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
 * POURQUOI TOUTES LES ROUTES, ET PLUS SEULEMENT CELLES QUI PORTENT `@Roles`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La relecture n'a d'abord eu lieu que sur les routes déclarant `@Roles`, au
 * motif que les autres « ne décident rien d'après le rôle ». C'ÉTAIT FAUX, et
 * la liste des contre-exemples n'était pas courte : `isAdmin(user)` est lu à
 * l'INTÉRIEUR des services, sur des routes qui ne portent aucun décorateur.
 *
 *   · `sync/push`      : un ADMIN peut modifier et supprimer des lignes dont
 *                        il n'est pas l'auteur (`SyncService`, deux endroits) ;
 *   · `prospects/reassign` : un ADMIN peut rattacher à un autre commercial ;
 *   · `export/representants.xlsx` : un ADMIN exporte tout le monde ;
 *   · les listes prospects et représentants, la lecture, la modification et la
 *     suppression d'un représentant, et tout `analytics` : le cloisonnement
 *     par auteur y saute pour un ADMIN.
 *
 * Un administrateur rétrogradé gardait donc son autorité sur tous ces chemins
 * pendant la vie de son jeton, c'est-à-dire exactement le trou que cette garde
 * a été écrite pour fermer, atteint par une autre porte.
 *
 * DEUX RÉPARATIONS ÉTAIENT POSSIBLES, et le choix n'est pas un arbitrage de
 * coût. Énumérer les routes concernées demande une LISTE que rien n'oblige
 * personne à tenir à jour : la prochaine route qui lira `request.user.role`
 * dans son service rouvrira le trou en silence, et c'est précisément ainsi que
 * ce défaut est né. Relire sur toute requête authentifiée supprime la liste.
 * Il n'y a plus de cas particulier à connaître, donc plus rien à oublier.
 *
 * Le test de cette garde exerce nommément une route SANS `@Roles` : quiconque
 * remet une condition ici le voit en rouge.
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
 * CE QUE CELA COÛTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * UNE lecture par CLÉ PRIMAIRE, sur cinq colonnes, par requête authentifiée.
 * C'est l'accès le moins cher que PostgreSQL sache faire, et il est comparé à
 * ce qu'il remplace : un jeton qui porte l'autorité pendant quinze minutes.
 * Les requêtes non authentifiées (santé, connexion, rafraîchissement) n'ont pas
 * d'identité à relire et ne paient rien.
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
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    // AUCUNE identité à rafraîchir : route publique, ou transport qui n'en
    // porte pas. C'est le SEUL cas dispensé, et il ne dépend d'aucun
    // décorateur, donc d'aucune liste à tenir.
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
