import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { IMPORT_ADAPTERS, type ImportAdapter } from './import-adapter.js';
import { IMPORT_FILE_STORE, DiskImportFileStore } from './import-file.store.js';
import { ImportRunnerService } from './import-runner.service.js';
import { ImportsController } from './imports.controller.js';
import { ImportsCron } from './imports.cron.js';
import { readImportsEnv } from './imports.env.js';
import { ImportsService } from './imports.service.js';
import { ProspectsGrandPublicImportAdapter } from './prospects-grand-public.adapter.js';
import { ProspectsImportAdapter } from './prospects-import.adapter.js';
import { RepresentantsImportAdapter } from './representants.adapter.js';
import { VisitesImportAdapter } from './visites.adapter.js';
import { VisitesRegistreAdapter } from './visites-registre.adapter.js';
import { VisitesRegistreRevueService } from './visites-registre.revue.service.js';
import { ExcelStreamRowReader, IMPORT_ROW_READER } from './xlsx-rows.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    ImportRunnerService,
    ImportsCron,
    RepresentantsImportAdapter,
    ProspectsImportAdapter,
    ProspectsGrandPublicImportAdapter,
    VisitesImportAdapter,
    VisitesRegistreAdapter,
    VisitesRegistreRevueService,
    {
      provide: IMPORT_ADAPTERS,
      useFactory: (
        representants: RepresentantsImportAdapter,
        prospects: ProspectsImportAdapter,
        grandPublic: ProspectsGrandPublicImportAdapter,
        visites: VisitesImportAdapter,
        visitesRegistre: VisitesRegistreAdapter,
      ): readonly ImportAdapter<unknown>[] => [
        representants,
        prospects,
        grandPublic,
        visites,
        visitesRegistre,
      ],
      inject: [
        RepresentantsImportAdapter,
        ProspectsImportAdapter,
        ProspectsGrandPublicImportAdapter,
        VisitesImportAdapter,
        VisitesRegistreAdapter,
      ],
    },
    { provide: IMPORT_ROW_READER, useFactory: () => new ExcelStreamRowReader() },
    {
      provide: IMPORT_FILE_STORE,
      useFactory: () => new DiskImportFileStore(readImportsEnv().IMPORTS_DIR),
    },
  ],
  exports: [ImportsService, VisitesRegistreRevueService],
})
export class ImportsModule {}
