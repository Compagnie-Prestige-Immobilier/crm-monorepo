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
 * En cas d'échec de lecture, on répond `false` — mode ÉTEINT. C'est le défaut
 * sûr : une base injoignable ne doit pas faire apparaître des fiches fictives
 * dans un export transmis au siège. L'erreur inverse serait invisible et
 * durable.
 */
@Injectable()
export class DemoVisibilityService {
  private cached: { value: boolean; readAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async enabled(): Promise<boolean> {
    const now = Date.now();
    if (this.cached !== null && now - this.cached.readAt < TTL_MS) {
      return this.cached.value;
    }

    let value = false;
    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { key: DEMO_MODE_SETTING },
      });
      value = row?.value === 'true';
    } catch {
      value = false;
    }

    this.cached = { value, readAt: now };
    return value;
  }

  /** À appeler juste après une bascule, pour ne pas servir l'état précédent. */
  invalidate(): void {
    this.cached = null;
  }
}
