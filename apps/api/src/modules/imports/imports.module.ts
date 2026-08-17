import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { IMPORT_ADAPTERS, type ImportAdapter } from './import-adapter.js';
import { IMPORT_FILE_STORE, DiskImportFileStore } from './import-file.store.js';
import { ImportRunnerService } from './import-runner.service.js';
import { ImportsController } from './imports.controller.js';
import { ImportsCron } from './imports.cron.js';
import { readImportsEnv } from './imports.env.js';
import { ImportsService } from './imports.service.js';
import { ProspectsImportAdapter } from './prospects-import.adapter.js';
import { RepresentantsImportAdapter } from './representants.adapter.js';
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
    {
      provide: IMPORT_ADAPTERS,
      useFactory: (
        representants: RepresentantsImportAdapter,
        prospects: ProspectsImportAdapter,
      ): readonly ImportAdapter<unknown>[] => [representants, prospects],
      inject: [RepresentantsImportAdapter, ProspectsImportAdapter],
    },
    { provide: IMPORT_ROW_READER, useFactory: () => new ExcelStreamRowReader() },
    {
      provide: IMPORT_FILE_STORE,
      useFactory: () => new DiskImportFileStore(readImportsEnv().IMPORTS_DIR),
    },
  ],
})
export class ImportsModule {}
