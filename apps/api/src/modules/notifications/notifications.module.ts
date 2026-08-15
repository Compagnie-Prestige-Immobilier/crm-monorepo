import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { NotificationsController } from './notifications.controller.js';
import { NotificationTemplatesController } from './templates.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationTemplatesService } from './templates.service.js';
import { RemindersService } from './reminders.service.js';
import { BREVO_TRANSPORT, BrevoHttpTransport, NullBrevoTransport } from './brevo.transport.js';
import { readNotificationsEnv } from './notifications.env.js';

/**
 * Notifications : composition, éventail, boîte de réception et rappels.
 *
 * `PrismaModule` est global : il n'a pas à figurer dans les imports.
 *
 * `ScheduleModule.forRoot()` est déclaré ICI et non à la racine : c'est le seul
 * module qui possède des tâches planifiées, et l'y laisser évite d'imposer un
 * ordonnanceur à une application qui n'en voudrait pas. `forRoot()` est
 * idempotent, si la racine finit par le déclarer aussi, rien ne casse.
 *
 * IL N'Y A PLUS DE PUSH. Firebase a été retiré de l'application mobile : plus
 * aucun client ne peut enregistrer de jeton d'appareil, donc plus aucun message
 * ne pouvait partir. Les deux canaux qui restent sont la BOÎTE DE RÉCEPTION,
 * que le mobile interroge, et l'E-MAIL pour les téléconseillers.
 *
 * LE CHOIX DE TRANSPORT EST FAIT AU DÉMARRAGE, PAS À CHAQUE ENVOI : sans clé
 * Brevo exploitable on injecte un transport inerte plutôt qu'un client HTTP qui
 * échouerait à chaque appel. Le mode dégradé devient une propriété du CÂBLAGE,
 * visible en lisant ce fichier, et non une condition enfouie dans une méthode
 * d'envoi.
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [NotificationsController, NotificationTemplatesController],
  providers: [
    NotificationsService,
    NotificationTemplatesService,
    RemindersService,
    {
      provide: BREVO_TRANSPORT,
      useFactory: () => {
        const config = readNotificationsEnv();
        const ready = Boolean(config.BREVO_API_KEY?.trim() && config.BREVO_SENDER_EMAIL?.trim());
        return ready ? new BrevoHttpTransport() : new NullBrevoTransport();
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
