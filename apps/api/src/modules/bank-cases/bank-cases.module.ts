import { Module } from '@nestjs/common';

import { BankCasesController } from './bank-cases.controller.js';
import { BankCaseStagesController } from './bank-case-stages.controller.js';
import { BankCasesExportController } from './bank-cases-export.controller.js';
import { BankCasesService } from './bank-cases.service.js';
import { BankCaseStagesService } from './bank-case-stages.service.js';
import { BankCaseAnalyticsService } from './bank-cases-analytics.service.js';
import { BankCasesExportService } from './bank-cases-export.service.js';

@Module({
  controllers: [BankCasesController, BankCaseStagesController, BankCasesExportController],
  providers: [
    BankCasesService,
    BankCaseStagesService,
    BankCaseAnalyticsService,
    BankCasesExportService,
  ],
  exports: [BankCasesService, BankCaseAnalyticsService],
})
export class BankCasesModule {}
