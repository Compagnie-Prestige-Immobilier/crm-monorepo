import { Inject, Injectable, Logger } from '@nestjs/common';
import { DevicePlatform } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { FCM_TRANSPORT, type FcmTransport } from './fcm.transport.js';
import type { DeviceTokenDto, RegisterDeviceDto, UnregisterDeviceDto } from './dto.js';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FCM_TRANSPORT) private readonly transport: FcmTransport,
  ) {}

  /**
   * Enregistre ou rafraîchit le jeton FCM de l'appareil courant.
   *
   * LE POINT DÉLICAT EST LA RÉATTRIBUTION. Les téléphones se prêtent, et sur le
   * terrain c'est fréquent : un commercial dépanne un collègue dont l'appareil
   * est déchargé. Le jeton FCM appartient à l'INSTALLATION, pas à la personne.
   *
   * `upsert` sur la clé unique `token` fait donc basculer le propriétaire au
   * lieu de créer une seconde ligne. Le comportement naïf — insérer sans
   * regarder — laisserait l'ancien propriétaire rattaché à un appareil qui
   * n'est plus le sien : ses notifications, y compris nominatives, sonneraient
   * chez quelqu'un d'autre. Ce n'est pas un doublon, c'est une fuite.
   *
   * `revokedAt: null` est réécrit explicitement : un jeton révoqué à la
   * déconnexion doit redevenir vivant à la reconnexion, sinon l'utilisateur ne
   * reçoit plus jamais rien et rien ne le signale.
   */
  async register(user: AuthenticatedUser, body: RegisterDeviceDto): Promise<DeviceTokenDto> {
    const now = new Date();
    const pendingOps = body.pendingOps ?? 0;

    const existing = await this.prisma.deviceToken.findUnique({
      where: { token: body.token },
      select: { userId: true, pendingSince: true, pendingOps: true },
    });

    // `pendingSince` marque le DÉBUT du retard, pas sa dernière observation.
    // L'écraser à chaque battement de cœur remettrait le compteur à zéro toutes
    // les quinze minutes, et le rappel « saisies non synchronisées » ne
    // partirait jamais.
    let pendingSince: Date | null;
    if (pendingOps === 0) {
      pendingSince = null;
    } else {
      pendingSince = existing?.pendingSince ?? now;
    }

    const row = await this.prisma.deviceToken.upsert({
      where: { token: body.token },
      create: {
        userId: user.id,
        token: body.token,
        platform: body.platform ?? DevicePlatform.ANDROID,
        appVersion: body.appVersion ?? null,
        lastSeenAt: now,
        pendingOps,
        pendingSince: pendingOps > 0 ? now : null,
      },
      update: {
        userId: user.id,
        platform: body.platform ?? DevicePlatform.ANDROID,
        appVersion: body.appVersion ?? null,
        lastSeenAt: now,
        revokedAt: null,
        pendingOps,
        pendingSince,
      },
      select: {
        id: true,
        platform: true,
        appVersion: true,
        lastSeenAt: true,
      },
    });

    if (existing && existing.userId !== user.id) {
      // Journalisé parce qu'un transfert d'appareil est un événement de
      // sécurité intéressant, sans jamais écrire le jeton lui-même.
      this.logger.log(
        `Appareil réattribué : ${existing.userId} → ${user.id}. L’ancien propriétaire ne reçoit plus rien sur cet appareil.`,
      );
    }

    return {
      id: row.id,
      platform: row.platform,
      appVersion: row.appVersion,
      lastSeenAt: row.lastSeenAt.toISOString(),
      pushEnabled: this.transport.isConfigured(),
    };
  }

  /**
   * Révoque un jeton à la déconnexion.
   *
   * On RÉVOQUE au lieu de supprimer : les lignes de livraison déjà écrites
   * citent le jeton, et l'historique d'un envoi ne doit pas s'effacer parce que
   * quelqu'un s'est déconnecté.
   *
   * Le `where` inclut `userId` : un appelant ne peut pas éteindre l'appareil
   * d'un autre en devinant son jeton.
   */
  async unregister(user: AuthenticatedUser, body: UnregisterDeviceDto): Promise<{ ok: boolean }> {
    await this.prisma.deviceToken.updateMany({
      where: { token: body.token, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), pendingOps: 0, pendingSince: null },
    });
    // Toujours `ok` : une déconnexion ne doit jamais échouer côté client. Un
    // jeton déjà révoqué, ou inconnu, est un non-événement.
    return { ok: true };
  }
}
