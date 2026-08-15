import { ConflictException, Injectable } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

/**
 * Code machinable du refus d'écrire quand l'état du mode est inconnu.
 *
 * DISTINCT de `DEMO_MODE_READ_ONLY` : celui-là dit « une démonstration est en
 * cours », affirmation que l'on ne peut justement pas faire ici. Un opérateur
 * qui lit ce code dans un journal doit chercher du côté de la base, pas du
 * côté d'un administrateur ayant basculé un interrupteur.
 */
export const DEMO_MODE_STATE_UNKNOWN = 'DEMO_MODE_STATE_UNKNOWN';

/**
 * 409 et non 500 : l'état de la plateforme est en cause, pas la requête, et il
 * changera de lui-même. C'est le même statut que le refus de lecture seule, ce
 * qui évite d'élargir le contrat des routes concernées, toutes déjà porteuses
 * d'un 409.
 */
const demoStateUnknown = (): ConflictException =>
  new ConflictException({
    code: DEMO_MODE_STATE_UNKNOWN,
    message:
      'Impossible de lire l’état du mode démonstration : l’écriture est refusée pour ne pas ' +
      'enregistrer une ligne dont on ne saurait pas dire si elle est réelle. Réessayez.',
  });

/**
 * Clé du réglage portant l'état de l'interrupteur de démonstration.
 *
 * Elle vit ICI et non dans `modules/demo/` : les services de lecture en ont
 * besoin, et faire remonter `prisma/` vers `modules/` inverserait les couches.
 * `demo-registry.ts` la réexporte, pour que le module démonstration continue de
 * la lire à l'endroit où on l'y cherche.
 */
export const DEMO_MODE_SETTING = 'demo_mode';

/**
 * Durée du cache, en millisecondes.
 *
 * Sans cache, CHAQUE lecture de prospect ajouterait un aller-retour en base
 * pour relire une ligne qui change deux fois par mois. Le tableau de bord tire
 * une douzaine d'agrégats par affichage : ce serait douze requêtes de plus.
 *
 * Deux secondes, et non deux minutes : c'est le délai maximal pendant lequel un
 * administrateur qui vient de basculer l'interrupteur pourrait encore voir
 * l'ancien état. `invalidate()` supprime même ce délai sur l'instance qui a
 * traité la bascule ; le cache court couvre les AUTRES instances, qui n'ont
 * aucun moyen d'être prévenues.
 */
const TTL_MS = 2_000;

/**
 * Durée pendant laquelle une lecture EN ÉCHEC n'est pas retentée.
 *
 * ═══ LE PROBLÈME QUE CE PLAFOND RÉSOUT ═══
 *
 * Ne pas mettre `unknown` en cache est délibéré : figer l'incertitude deux
 * secondes ferait refuser des écritures deux secondes après le rétablissement
 * de la base. Mais sans AUCUN plafond, chaque appelant repart en base, et
 * l'appelant est ici presque chaque lecture de l'API. Une base déjà en peine
 * reçoit alors le débit complet de la plateforme en requêtes de réglage, au
 * moment précis où elle a besoin qu'on la laisse respirer.
 *
 * ═══ POURQUOI UNE SECONDE ═══
 *
 * Le plafond ne peut pas être choisi dans l'absolu, il se choisit PAR RAPPORT
 * au TTL positif. Plus long que lui, il rendrait l'incertitude plus collante
 * qu'une certitude, ce qui est exactement l'inverse de l'intention. Assez court
 * pour qu'une panne de trois secondes ne coûte pas une minute de refus.
 *
 * Une seconde tient les deux bouts : c'est la moitié du TTL positif, donc
 * l'incertitude reste toujours plus courte que la certitude ; et cela ramène le
 * pire cas à UNE requête de réglage par seconde et par instance, quel que soit
 * le trafic, contre des centaines auparavant.
 *
 * Le rétablissement, lui, ne dépend pas de ce délai pour l'essentiel :
 * `inFlight` fait déjà tenir tous les appelants simultanés sur UNE seule
 * requête, et c'est cette fusion qui retire le gros de la charge.
 */
const UNKNOWN_TTL_MS = 1_000;

/**
 * Le mode démonstration est-il allumé ?
 *
 * Une seule source pour tous les services de lecture. Le réglage est en base et
 * non dans l'environnement : il se bascule depuis le panel, sans redémarrage.
 *
 * En cas d'échec de lecture, `enabled()` répond `false`, mode ÉTEINT. C'est le
 * défaut sûr POUR UNE LECTURE : une base injoignable ne doit pas faire
 * apparaître des fiches fictives dans un export transmis au siège. L'erreur
 * inverse serait invisible et durable.
 *
 * Ce repli est le MAUVAIS dès qu'il décide d'une valeur écrite ou d'un droit,
 * où `false` veut dire « laisse faire » : `state()` et `enabledForWrite()`
 * existent pour ces appelants-là, et refusent dans le doute. Choisir entre les
 * deux n'est pas un détail de style, c'est le sens de sécurité du repli.
 */
@Injectable()
export class DemoVisibilityService {
  private cached: { value: boolean; readAt: number } | null = null;

  /**
   * Lecture EN COURS, partagée par tous les appelants qui arrivent pendant
   * qu'elle vole.
   *
   * Sans elle, cinquante requêtes concurrentes sur un cache expiré produisent
   * cinquante requêtes de réglage identiques : le cache ne protège que les
   * appels SÉQUENTIELS, et une API sert par nature des appels simultanés. La
   * promesse est effacée dans son `finally`, jamais avant, sinon un appelant
   * pourrait s'accrocher à une promesse déjà retirée et en lancer une seconde.
   */
  private inFlight: Promise<'on' | 'off' | 'unknown'> | null = null;

  /** Date de la dernière lecture EN ÉCHEC. Voir `UNKNOWN_TTL_MS`. */
  private unknownAt: number | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async enabled(): Promise<boolean> {
    return (await this.state()) === 'on';
  }

  /**
   * Le même booléen, mais pour DÉCIDER D'UNE VALEUR ÉCRITE.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * POURQUOI `enabled()` NE CONVIENT PAS ICI
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `enabled()` rend `false` quand la lecture du réglage échoue. C'est le bon
   * repli pour une VISIBILITÉ : dans le doute on masque, personne ne voit de
   * fausse donnée. Mais plusieurs services composaient ce même booléen dans un
   * `isDemo:`, et là `false` ne veut plus dire « masque », il veut dire
   * « cette ligne est RÉELLE ».
   *
   * Une panne de lecture d'une seconde pendant une démonstration écrivait donc
   * la fiche saisie devant l'auditoire en ligne réelle : elle survivait à
   * l'extinction, entrait dans les listes et les exports, et la purge ne savait
   * pas la reprendre puisqu'elle ne figure pas dans `demo_entities`. Le repli
   * réputé sûr s'inversait en changeant d'usage, exactement comme pour la garde
   * d'écriture.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * POURQUOI REFUSER PLUTÔT QUE DEVINER
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Les deux valeurs par défaut sont mauvaises. `false` avale du travail de
   * démonstration dans le réel ; `true` avale du travail RÉEL dans le fictif,
   * qui est pire encore (la ligne disparaît des écrans à l'extinction). Il n'y
   * a pas de repli correct, donc on n'en choisit aucun : on refuse l'écriture.
   *
   * Le coût est modeste et borné, c'est le même raisonnement que dans
   * `DemoReadOnlyGuard` : la lecture du réglage échoue quand la base est en
   * difficulté, et l'écriture refusée ici aurait de toute façon échoué une
   * couche plus bas, avec un message bien moins clair.
   *
   * `DemoReadOnlyGuard` couvre déjà le chemin HTTP ordinaire, mais il ne juge
   * QUE des requêtes HTTP non dispensées. Ces appels-ci doivent tenir seuls,
   * pour une route dispensée comme pour un futur appel interne.
   */
  async enabledForWrite(): Promise<boolean> {
    const state = await this.state();
    if (state === 'unknown') throw demoStateUnknown();
    return state === 'on';
  }

  /**
   * L'état RÉEL, qui distingue « éteint » de « on ne sait pas ».
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * POURQUOI TROIS VALEURS ET NON UN BOOLÉEN
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `enabled()` rend `false` quand la lecture du réglage échoue, et c'est le bon
   * repli POUR LA VISIBILITÉ : dans le doute, on masque les lignes fictives.
   * Personne ne voit de fausse donnée.
   *
   * Mais la garde d'écriture s'est branchée sur le même booléen, et pour ELLE,
   * `false` veut dire « laisse écrire ». Le même repli, réputé sûr, s'inverse
   * en passant d'un usage à l'autre : une panne de lecture pendant une
   * démonstration rouvrait silencieusement les écritures que le mode venait
   * suspendre, et les lignes créées repartaient en `isDemo: false`.
   *
   * Un booléen ne peut pas porter deux sens de sécurité opposés. `unknown`
   * force donc chaque appelant à dire ce qu'il fait de l'incertitude : la
   * lecture masque, l'écriture refuse.
   */
  async state(): Promise<'on' | 'off' | 'unknown'> {
    const now = Date.now();
    if (this.cached !== null && now - this.cached.readAt < TTL_MS) {
      return this.cached.value ? 'on' : 'off';
    }

    // Échec RÉCENT : on ne repart pas en base tout de suite. Le repli reste
    // `unknown`, donc aucune décision ne change ; seule la pression sur une
    // base en difficulté est bornée. Voir `UNKNOWN_TTL_MS`.
    if (this.unknownAt !== null && now - this.unknownAt < UNKNOWN_TTL_MS) return 'unknown';

    // Une lecture vole déjà : on s'y accroche au lieu d'en lancer une seconde.
    this.inFlight ??= this.read(now);
    return this.inFlight;
  }

  /**
   * La lecture elle-même, et la seule qui touche la base.
   *
   * Séparée de `state()` pour que `inFlight` soit posée AVANT le premier
   * `await` : entre l'appel et la résolution, tout autre appelant doit trouver
   * la promesse déjà en place, sans quoi la fusion ne servirait à rien.
   */
  private async read(now: number): Promise<'on' | 'off' | 'unknown'> {
    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { key: DEMO_MODE_SETTING },
      });
      // Une ligne ABSENTE vaut `off`, et se met en cache comme telle : le
      // réglage supprimé décrit une plateforme sans démonstration, ce n'est pas
      // une incertitude. Ne pas le mettre en cache ferait relire la base à
      // chaque requête sur toute installation qui n'a jamais fait de
      // démonstration, c'est-à-dire presque toutes.
      const value = row?.value === 'true';
      this.cached = { value, readAt: now };
      this.unknownAt = null;
      return value ? 'on' : 'off';
    } catch {
      // PAS de mise en cache de l'ÉTAT : une panne transitoire ne doit pas
      // figer l'incertitude pour toute la durée du TTL positif. Seule la DATE
      // de l'échec est retenue, et pour un délai bien plus court, afin de
      // borner le martèlement sans geler la décision.
      this.unknownAt = Date.now();
      return 'unknown';
    } finally {
      this.inFlight = null;
    }
  }

  /** À appeler juste après une bascule, pour ne pas servir l'état précédent. */
  invalidate(): void {
    this.cached = null;
    // L'échec récent est oublié LUI AUSSI : une bascule est une information
    // fraîche et certaine, elle doit primer sur un doute vieux d'une seconde.
    this.unknownAt = null;
  }
}
