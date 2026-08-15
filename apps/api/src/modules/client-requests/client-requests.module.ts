import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { ClientRequestsController } from './client-requests.controller.js';
import { ClientRequestsService } from './client-requests.service.js';

/**
 * Demandes de création de client, de la banque vers l'administrateur.
 *
 * `PrismaModule` est global : il n'a pas à figurer dans les imports.
 * `NotificationsModule` l'est explicitement, parce que c'est la notification
 * qui fait de ce module autre chose qu'une table de plus : sans elle, une
 * demande attendrait qu'un administrateur pense à ouvrir l'écran.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [ClientRequestsController],
  providers: [ClientRequestsService],
  exports: [ClientRequestsService],
})
export class ClientRequestsModule {}
