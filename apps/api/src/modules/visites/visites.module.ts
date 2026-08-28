import { Module } from '@nestjs/common';

import { ImportsModule } from '../imports/imports.module.js';
import { VisitesController } from './visites.controller.js';
import { VisitesImportController } from './visites-import.controller.js';
import { VisitesService } from './visites.service.js';
import { VisitesStatsService } from './visites-stats.service.js';
import { VisiteReferentielsService } from './visite-referentiels.service.js';

@Module({
  imports: [ImportsModule],
  controllers: [VisitesController, VisitesImportController],
  providers: [VisitesService, VisitesStatsService, VisiteReferentielsService],
  exports: [VisitesService],
})
export class VisitesModule {}
