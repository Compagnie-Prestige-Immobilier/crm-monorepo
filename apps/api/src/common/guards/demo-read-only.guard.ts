import { CanActivate, ConflictException, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { DEMO_WRITABLE_KEY } from '../decorators/demo-writable.decorator.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';

/**
 * Pendant une démonstration, la plateforme est en LECTURE SEULE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT QUE CETTE GARDE RÉPARE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `demo_mode` est UN SEUL réglage, global au serveur. Il n'est ni par
 * utilisateur, ni par session : quand un administrateur l'allume pour une
 * réunion, il l'allume pour les quarante commerciaux qui sont sur le terrain
 * au même instant.
 *
 * La correction précédente propageait `isDemo: demoEnabled` sur chaque
 * création, pour que les lignes saisies pendant une démonstration ne polluent
 * pas les chiffres de production. Sur un interrupteur global, cette règle
 * produit un défaut PIRE que celui qu'elle corrige : les quatre prospects
 * qu'un commercial a réellement saisis pendant la fenêtre sont écrits
 * `isDemo: true`, puis DISPARAISSENT de tous les écrans et de tous les exports
 * dès que l'interrupteur retombe. Les lignes survivent en base, et la purge de
 * démonstration ne sait même pas les reprendre : elle ne supprime que les
 * identifiants inscrits dans `demo_entities`.
 *
 * Avaler du travail réel est plus grave que de polluer un compteur. La
 * décision retenue est donc l'inverse : pendant la démonstration, on N'ÉCRIT
 * PLUS. Il n'y a alors plus rien à colorier, et la question « cette ligne
 * est-elle réelle ? » ne se pose plus.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * L'EXEMPTION ABSOLUE : LA REMONTÉE HORS LIGNE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La synchronisation mobile n'est JAMAIS refusée. La file d'un commercial
 * contient des saisies faites des heures plus tôt, dans un village sans
 * réseau ; les refuser parce que quelqu'un a basculé un interrupteur au bureau
 * ferait remonter des opérations parfaitement valides dans « À corriger »
 * après huit tentatives. C'est une exigence dure, pas une préférence.
 *
 * Conséquence directe, et c'est ce qui rend l'ensemble cohérent : tout ce qui
 * arrive encore par un chemin dispensé est du travail RÉEL. Ces chemins
 * écrivent donc `isDemo: false`, jamais `isDemo: demoEnabled`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UNE GARDE, ET POURQUOI EN DERNIER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une garde et non un intercepteur : le refus doit tomber AVANT que le
 * contrôleur ne soit appelé, donc avant toute écriture. `DemoModeInterceptor`
 * est un intercepteur parce qu'il se contente d'estampiller la réponse.
 *
 * Enregistrée APRÈS `JwtAuthGuard` et `RolesGuard` : une requête sans jeton
 * doit répondre 401 et non 409. Le mode démonstration n'est pas une raison de
 * renseigner un anonyme sur l'état interne du serveur.
 *
 * La lecture du réglage est mise en cache deux secondes par
 * `DemoVisibilityService` : la garde n'ajoute pas un aller-retour en base par
 * requête. Et elle ne lit RIEN quand la méthode n'est pas mutante, ce qui est
 * le cas de la grande majorité du trafic.
 */

/**
 * Méthodes considérées comme mutantes.
 *
 * `GET`, `HEAD` et `OPTIONS` en sont absents parce qu'ils ne peuvent rien
 * écrire ; les lister ici pour « faire propre » coûterait une lecture de
 * réglage sur chaque affichage de tableau de bord.
 */
const MUTATING_METHODS: ReadonlySet<string> = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Code machinable du refus. C'est SUR LUI que les clients branchent. */
export const DEMO_MODE_READ_ONLY = 'DEMO_MODE_READ_ONLY';

/**
 * Phrase rendue au client. Elle nomme la cause ET le remède : un utilisateur
 * qui lit « conflit » sans savoir qu'un administrateur a allumé une
 * démonstration croit à une panne et rappelle le support.
 */
export const DEMO_MODE_READ_ONLY_MESSAGE =
  'La plateforme est en mode démonstration : les écritures sont suspendues. ' +
  'Vos saisies mobiles hors ligne continuent d’être acceptées. Demandez à un ' +
  'administrateur de désactiver le mode démonstration pour reprendre la saisie.';

@Injectable()
export class DemoReadOnlyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly demo: DemoVisibilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Les contextes non HTTP (tâches planifiées, appels internes) ne passent
    // pas par une garde ; le `getType` protège tout de même contre un futur
    // transport, où `switchToHttp()` rendrait un objet vide.
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<{ method?: string }>();
    if (!MUTATING_METHODS.has((request.method ?? '').toUpperCase())) return true;

    // `getAllAndOverride` : la méthode l'emporte sur la classe, ce qui permet
    // de dispenser une seule route d'un contrôleur par ailleurs bloqué.
    const reason = this.reflector.getAllAndOverride<string | undefined>(DEMO_WRITABLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (reason !== undefined) return true;

    // `state()` et non `enabled()`, et le refus porte AUSSI sur `unknown`.
    //
    // `enabled()` rend `false` quand la lecture du réglage échoue. Ce repli est
    // juste pour la visibilité, où il masque les lignes fictives, mais ici
    // `false` veut dire « laisse passer l'écriture » : le même repli, réputé
    // sûr, s'inversait en changeant d'usage. Une panne de lecture pendant une
    // démonstration rouvrait donc silencieusement les écritures que le mode
    // venait de suspendre.
    //
    // Dans le doute on refuse. Le coût est modeste et borné : la lecture
    // échoue quand la base est en difficulté, et l'écriture qu'on refuse ici
    // aurait de toute façon échoué une couche plus bas, avec un message bien
    // moins clair.
    if ((await this.demo.state()) === 'off') return true;

    // 409 et non 403 : le rôle de l'appelant n'est pas en cause, c'est l'ÉTAT
    // de la plateforme qui l'est, et il changera. Un 403 ferait croire à un
    // problème de droits et enverrait l'utilisateur vers le mauvais support.
    // Le filtre global complète ensuite `statusCode` et `requestId`, si bien
    // que le corps sort à la forme `ApiErrorDto` comme toutes les autres
    // erreurs.
    throw new ConflictException({
      code: DEMO_MODE_READ_ONLY,
      message: DEMO_MODE_READ_ONLY_MESSAGE,
    });
  }
}
