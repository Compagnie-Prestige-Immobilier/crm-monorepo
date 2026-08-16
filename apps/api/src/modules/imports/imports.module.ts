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

/**
 * Imports de masse, en arrière-plan. ADMIN uniquement.
 *
 * `PrismaModule` est global : il n'a pas à figurer dans les imports.
 *
 * `ScheduleModule.forRoot()` est déclaré ICI comme il l'est dans
 * `NotificationsModule` : `forRoot()` est idempotent, deux modules qui le
 * déclarent ne se gênent pas, et chacun reste montable seul dans un test.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TROIS EFFETS, TROIS JETONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le lecteur de classeur, le dépôt de fichiers et la LISTE DES ADAPTATEURS sont
 * fournis par jeton, jamais par leur classe. C'est ce qui rend le moteur
 * exerçable : les tests substituent une source de lignes en mémoire et un dépôt
 * sans disque, et tout le reste (bail, tranches, transactions, reprise, plafond,
 * rapport) est éprouvé pour de vrai, sans volume et sans PostgreSQL. Même
 * discipline que `BREVO_TRANSPORT` et `DUMP_RUNNER`.
 *
 * AJOUTER UNE ENTITÉ SE FAIT ICI, ET NULLE PART AILLEURS : on écrit un
 * adaptateur, on le déclare en fournisseur, et on l'ajoute à la fabrique de
 * `IMPORT_ADAPTERS`. Le moteur n'est pas rouvert.
 */
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
