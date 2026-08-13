import { Module } from '@nestjs/common';

import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { FunnelService } from './funnel.service.js';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, FunnelService],
  exports: [AnalyticsService, FunnelService],
})
export class AnalyticsModule {}
