import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { NotificationsController } from './notifications.controller.js';
import { DevicesController } from './devices.controller.js';
import { NotificationTemplatesController } from './templates.controller.js';
import { NotificationsService } from './notifications.service.js';
import { DevicesService } from './devices.service.js';
import { NotificationTemplatesService } from './templates.service.js';
import { RemindersService } from './reminders.service.js';
import { FCM_TRANSPORT, FcmHttpTransport, NullFcmTransport } from './fcm.transport.js';
import { parseServiceAccount, readNotificationsEnv } from './notifications.env.js';

/**
 * Notifications push — composition, éventail, boîte de réception et rappels.
 *
 * `PrismaModule` est global : il n'a pas à figurer dans les imports.
 *
 * `ScheduleModule.forRoot()` est déclaré ICI et non à la racine : c'est le seul
 * module qui possède des tâches planifiées, et l'y laisser évite d'imposer un
 * ordonnanceur à une application qui n'en voudrait pas. `forRoot()` est
 * idempotent — si la racine finit par le déclarer aussi, rien ne casse.
 *
 * LE CHOIX DE TRANSPORT EST FAIT AU DÉMARRAGE, PAS À CHAQUE ENVOI. Sans compte
 * de service exploitable, on injecte un transport inerte plutôt qu'un client
 * HTTP qui échouerait à chaque appel : le mode dégradé devient alors une
 * propriété du CÂBLAGE, visible en lisant ce fichier, et non une condition
 * enfouie dans une méthode d'envoi.
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [NotificationsController, DevicesController, NotificationTemplatesController],
  providers: [
    NotificationsService,
    DevicesService,
    NotificationTemplatesService,
    RemindersService,
    {
      provide: FCM_TRANSPORT,
      useFactory: () => {
        const account = parseServiceAccount(readNotificationsEnv().FCM_SERVICE_ACCOUNT_JSON);
        return account ? new FcmHttpTransport() : new NullFcmTransport();
      },
    },
  ],
  exports: [NotificationsService, DevicesService],
})
export class NotificationsModule {}
