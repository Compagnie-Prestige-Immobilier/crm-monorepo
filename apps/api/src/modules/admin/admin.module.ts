import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../analytics/analytics.module.js';
import { AdminController } from './admin.controller.js';
import { PurgeService } from './purge.service.js';
import { SupervisionService } from './supervision.service.js';

@Module({
  imports: [AnalyticsModule],
  controllers: [AdminController],
  providers: [PurgeService, SupervisionService],
  exports: [PurgeService, SupervisionService],
})
export class AdminModule {}
