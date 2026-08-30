import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../analytics/analytics.module.js';
import { VisitesModule } from '../visites/visites.module.js';
import { ExportController } from './export.controller.js';
import { ExportService } from './export.service.js';
import { RepresentantsExportService } from './representants-export.service.js';
import { VisitesExportService } from './visites-export.service.js';

@Module({
  imports: [AnalyticsModule, VisitesModule],
  controllers: [ExportController],
  providers: [ExportService, RepresentantsExportService, VisitesExportService],
  exports: [ExportService, RepresentantsExportService],
})
export class ExportModule {}
