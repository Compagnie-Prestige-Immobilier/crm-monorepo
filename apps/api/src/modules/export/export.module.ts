import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../analytics/analytics.module.js';
import { ExportController } from './export.controller.js';
import { ExportService } from './export.service.js';

@Module({
  imports: [AnalyticsModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
