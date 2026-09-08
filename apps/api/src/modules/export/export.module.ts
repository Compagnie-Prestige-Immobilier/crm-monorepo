import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../analytics/analytics.module.js';
import { ChampsConversionModule } from '../champs-conversion/champs-conversion.module.js';
import { VisitesModule } from '../visites/visites.module.js';
import { ExportController } from './export.controller.js';
import { ExportService } from './export.service.js';
import { GlobalExportService } from './global-export.service.js';
import { RepresentantsExportService } from './representants-export.service.js';
import { VisitesExportService } from './visites-export.service.js';

@Module({
  imports: [AnalyticsModule, ChampsConversionModule, VisitesModule],
  controllers: [ExportController],
  providers: [ExportService, GlobalExportService, RepresentantsExportService, VisitesExportService],
  exports: [ExportService, RepresentantsExportService],
})
export class ExportModule {}
