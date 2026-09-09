import { Module } from '@nestjs/common';

import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { CampagnesService } from './campagnes.service.js';
import { FunnelService } from './funnel.service.js';
import { PilotageService } from './pilotage.service.js';
import { PortfolioService } from './portfolio.service.js';
import { QualityService } from './quality.service.js';
import { SegmentConversionsService } from './segment-conversions.service.js';
import { StockRepresentantsService } from './stock-representants.service.js';
import { SupervisionController } from './supervision.controller.js';
import { SupervisionActivityService } from './supervision.service.js';
import { WorkShiftsService } from './work-shifts.service.js';

@Module({
  controllers: [AnalyticsController, SupervisionController],
  providers: [
    AnalyticsService,
    CampagnesService,
    FunnelService,
    PilotageService,
    PortfolioService,
    QualityService,
    SegmentConversionsService,
    StockRepresentantsService,
    SupervisionActivityService,
    WorkShiftsService,
  ],
  exports: [
    AnalyticsService,
    FunnelService,
    PortfolioService,
    QualityService,
    SegmentConversionsService,
    SupervisionActivityService,
    WorkShiftsService,
  ],
})
export class AnalyticsModule {}
