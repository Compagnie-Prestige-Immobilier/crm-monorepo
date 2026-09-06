import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AnalyticsModule } from '../analytics/analytics.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationTemplatesController } from './templates.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationTemplatesService } from './templates.service.js';
import { RemindersService } from './reminders.service.js';
import { BREVO_TRANSPORT, BrevoHttpTransport, NullBrevoTransport } from './brevo.transport.js';
import { readNotificationsEnv } from './notifications.env.js';

@Module({
  imports: [ScheduleModule.forRoot(), AnalyticsModule],
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
  exports: [NotificationsService, RemindersService],
})
export class NotificationsModule {}
