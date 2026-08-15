import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

import { readEnv } from '../../env.js';

/**
 * L'export intégral n'existe QUE si `DB_DUMP_ENABLED` vaut true.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UN INTERRUPTEUR, ALORS QUE LA ROUTE EST DÉJÀ ADMIN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Parce que « réservé aux ADMIN » et « inaccessible » ne sont pas la même
 * chose. Ce que la fonctionnalité produit est un second exemplaire complet de
 * la clientèle, posé sur un volume, sans chiffrement ni contrôle d'accès
 * propre. Le rôle ADMIN protège cette porte contre les autres utilisateurs ; il
 * ne protège pas contre une session ADMIN volée, un jeton encore valide après
 * une rétrogradation, ou un défaut de la chaîne elle-même.
 *
 * L'interrupteur répond à une question différente : « ce parc-là veut-il de
 * cette porte ? ». Tant que la réponse n'est pas OUI, explicitement, dans
 * l'environnement du déploiement, il n'y a pas de porte. C'est la même posture
 * que `DEMO_MODE_ALLOWED` : le réglage fin vit peut-être ailleurs, mais le
 * garde-fou vit dans l'environnement, hors de portée de l'interface, et donc
 * hors de portée de quiconque a pris la main sur un compte administrateur.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 404 ET NON 403, DÉLIBÉRÉMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un 403 dit « cette route existe, et vous n'y avez pas droit ». Un 404 dit
 * « il n'y a rien ici », ce qui est exactement la vérité quand la variable est
 * absente : le déploiement n'offre pas cet export. C'est aussi ce que
 * répondrait un module non enregistré, si bien que l'interrupteur ne se trahit
 * pas par le code de retour.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UNE GARDE ET NON UN DÉSENREGISTREMENT DU MODULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Retirer `DbDumpModule` de `app.module.ts` selon la variable serait plus
 * radical, et c'était le premier réflexe. Il est faux ici : `openapi.ts` génère
 * le contrat en montant l'application SANS poser cette variable. Les trois
 * routes disparaîtraient donc du contrat, puis du client généré, et
 * `apps/web/src/lib/data/db-dump.ts` cesserait de compiler. Le contrat décrit
 * ce que l'API SAIT faire ; la variable décide ce que CE déploiement-ci accepte
 * de faire. Les deux plans sont distincts, et c'est la garde qui tient le
 * second.
 *
 * La lecture d'environnement n'est pas mise en cache : `readEnv()` analyse un
 * objet déjà en mémoire, et les gardes globales du dépôt (voir `JwtAuthGuard`)
 * l'appellent déjà à chaque requête.
 */
@Injectable()
export class DbDumpEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (readEnv().DB_DUMP_ENABLED) return true;
    throw new NotFoundException({
      code: 'DATABASE_DUMP_DISABLED',
      message: 'L’export intégral n’est pas activé sur ce déploiement.',
    });
  }
}
