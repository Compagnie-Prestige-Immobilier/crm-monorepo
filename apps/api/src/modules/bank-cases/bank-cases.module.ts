import { Module } from '@nestjs/common';

import { BankCasesController } from './bank-cases.controller.js';
import { BankCaseStagesController } from './bank-case-stages.controller.js';
import { BankCasesExportController } from './bank-cases-export.controller.js';
import { BankCasesService } from './bank-cases.service.js';
import { BankCaseStagesService } from './bank-case-stages.service.js';
import { BankCaseAnalyticsService } from './bank-cases-analytics.service.js';
import { BankCasesExportService } from './bank-cases-export.service.js';

/**
 * Banque & Finance — dossiers bancaires, workflow d'étapes et analytique.
 *
 * `PrismaModule` est global : il n'a pas à figurer dans les imports. Les
 * services sont exportés parce que l'export Excel du module consomme
 * l'analytique, et parce qu'un module tiers voudra un jour compter les
 * encaissements sans repasser par HTTP.
 */
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
