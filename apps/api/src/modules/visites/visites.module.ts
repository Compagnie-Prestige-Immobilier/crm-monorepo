import { Module } from '@nestjs/common';

import { VisitesController } from './visites.controller.js';
import { VisitesService } from './visites.service.js';
import { VisitesStatsService } from './visites-stats.service.js';
import { VisiteReferentielsService } from './visite-referentiels.service.js';

@Module({
  controllers: [VisitesController],
  providers: [VisitesService, VisitesStatsService, VisiteReferentielsService],
  exports: [VisitesService],
})
export class VisitesModule {}
