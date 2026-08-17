import { ConflictException, Injectable } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

/** Distinct de `DEMO_MODE_READ_ONLY` : ici la base est muette, pas le mode allumé. */
export const DEMO_MODE_STATE_UNKNOWN = 'DEMO_MODE_STATE_UNKNOWN';

/**
 * 409 et non 500 : l'état de la plateforme est en cause, pas la requête.
 * Code transverse à toute route mutante, donc déclaré dans `ApiErrorDto` et non
 * route par route.
 */
export const demoStateUnknown = (): ConflictException =>
  new ConflictException({
    code: DEMO_MODE_STATE_UNKNOWN,
    message:
      'Impossible de lire l’état du mode démonstration : l’écriture est refusée pour ne pas ' +
      'enregistrer une ligne dont on ne saurait pas dire si elle est réelle. Réessayez.',
  });

/** Vit ici et non dans `modules/demo/` : `prisma/` ne doit pas dépendre de `modules/`. */
export const DEMO_MODE_SETTING = 'demo_mode';

/** Court exprès : délai maximal pendant lequel les AUTRES instances voient l'ancien état. */
const TTL_MS = 2_000;

/**
 * L'état `unknown` n'est jamais mis en cache ; seule la DATE de l'échec l'est, et
 * pour la moitié du TTL positif, pour que l'incertitude reste moins collante que
 * la certitude tout en bornant le martèlement d'une base en difficulté.
 */
const UNKNOWN_TTL_MS = 1_000;

/**
 * Source unique de l'état du mode démonstration, lu en base pour se basculer sans
 * redémarrage.
 *
 * `enabled()` replie sur `false` en cas d'échec : bon défaut POUR UNE LECTURE, où
 * masquer est sûr. Mauvais dès qu'il décide d'une valeur écrite ou d'un droit, où
 * `false` veut dire « laisse faire » : ces appelants prennent `state()` ou
 * `enabledForWrite()`, qui refusent dans le doute.
 */
@Injectable()
export class DemoVisibilityService {
  private cached: { value: boolean; readAt: number } | null = null;

  /** Lecture en cours, partagée : le cache seul ne protège que les appels séquentiels. */
  private inFlight: Promise<'on' | 'off' | 'unknown'> | null = null;

  private unknownAt: number | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async enabled(): Promise<boolean> {
    return (await this.state()) === 'on';
  }

  /**
   * À composer dans un `isDemo:`, où aucun repli n'est correct : `false` écrirait
   * du travail de démonstration en réel, `true` du travail réel en fictif. On
   * refuse donc l'écriture au lieu de deviner.
   */
  async enabledForWrite(): Promise<boolean> {
    const state = await this.state();
    if (state === 'unknown') throw demoStateUnknown();
    return state === 'on';
  }

  /**
   * Trois valeurs et non un booléen : un booléen ne peut pas porter deux sens de
   * sécurité opposés. `unknown` force l'appelant à choisir — la lecture masque,
   * l'écriture refuse.
   */
  async state(): Promise<'on' | 'off' | 'unknown'> {
    const now = Date.now();
    if (this.cached !== null && now - this.cached.readAt < TTL_MS) {
      return this.cached.value ? 'on' : 'off';
    }

    if (this.unknownAt !== null && now - this.unknownAt < UNKNOWN_TTL_MS) return 'unknown';

    this.inFlight ??= this.read(now);
    return this.inFlight;
  }

  /**
   * Séparée de `state()` pour que `inFlight` soit posée AVANT le premier `await`,
   * sans quoi la fusion des appelants simultanés ne servirait à rien.
   */
  private async read(now: number): Promise<'on' | 'off' | 'unknown'> {
    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { key: DEMO_MODE_SETTING },
      });
      // Ligne absente = `off` mis en cache : c'est une certitude, pas une incertitude.
      const value = row?.value === 'true';
      this.cached = { value, readAt: now };
      this.unknownAt = null;
      return value ? 'on' : 'off';
    } catch {
      // Seule la DATE de l'échec est retenue, jamais l'état : voir `UNKNOWN_TTL_MS`.
      this.unknownAt = Date.now();
      return 'unknown';
    } finally {
      this.inFlight = null;
    }
  }

  invalidate(): void {
    this.cached = null;
    // L'échec récent est oublié lui aussi : une bascule prime sur un doute passé.
    this.unknownAt = null;
  }
}
