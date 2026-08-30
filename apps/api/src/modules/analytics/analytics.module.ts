import { Module } from '@nestjs/common';

import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { FunnelService } from './funnel.service.js';
import { PilotageService } from './pilotage.service.js';
import { PortfolioService } from './portfolio.service.js';
import { QualityService } from './quality.service.js';
import { SegmentConversionsService } from './segment-conversions.service.js';
import { SupervisionController } from './supervision.controller.js';
import { SupervisionActivityService } from './supervision.service.js';

@Module({
  controllers: [AnalyticsController, SupervisionController],
  providers: [
    AnalyticsService,
    FunnelService,
    PilotageService,
    PortfolioService,
    QualityService,
    SegmentConversionsService,
    SupervisionActivityService,
  ],
  exports: [
    AnalyticsService,
    FunnelService,
    PortfolioService,
    QualityService,
    SegmentConversionsService,
    SupervisionActivityService,
  ],
})
export class AnalyticsModule {}
