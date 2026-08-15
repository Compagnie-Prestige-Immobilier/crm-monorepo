import { Injectable } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

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
 * Le mode démonstration est-il allumé ?
 *
 * Une seule source pour tous les services de lecture. Le réglage est en base et
 * non dans l'environnement : il se bascule depuis le panel, sans redémarrage.
 *
 * En cas d'échec de lecture, on répond `false`, mode ÉTEINT. C'est le défaut
 * sûr : une base injoignable ne doit pas faire apparaître des fiches fictives
 * dans un export transmis au siège. L'erreur inverse serait invisible et
 * durable.
 */
@Injectable()
export class DemoVisibilityService {
  private cached: { value: boolean; readAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async enabled(): Promise<boolean> {
    return (await this.state()) === 'on';
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

    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { key: DEMO_MODE_SETTING },
      });
      const value = row?.value === 'true';
      this.cached = { value, readAt: now };
      return value ? 'on' : 'off';
    } catch {
      // PAS de mise en cache : une panne transitoire ne doit pas figer
      // l'incertitude pour toute la durée du TTL. La prochaine requête
      // retentera la lecture.
      return 'unknown';
    }
  }

  /** À appeler juste après une bascule, pour ne pas servir l'état précédent. */
  invalidate(): void {
    this.cached = null;
  }
}
