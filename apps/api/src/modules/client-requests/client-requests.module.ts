import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { ClientRequestsController } from './client-requests.controller.js';
import { ClientRequestsService } from './client-requests.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [ClientRequestsController],
  providers: [ClientRequestsService],
  exports: [ClientRequestsService],
})
export class ClientRequestsModule {}
