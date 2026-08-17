import { Module } from '@nestjs/common';

import { readEnv } from '../../env.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DbDumpController } from './db-dump.controller.js';
import { DbDumpEnabledGuard } from './db-dump-enabled.guard.js';
import { DbDumpService } from './db-dump.service.js';
import { DUMP_RUNNER, PgDumpRunner } from './db-dump.runner.js';

@Module({
  imports: [NotificationsModule],
  controllers: [DbDumpController],
  providers: [
    DbDumpService,
    DbDumpEnabledGuard,
    { provide: DUMP_RUNNER, useFactory: () => new PgDumpRunner(readEnv().DATABASE_URL) },
  ],
})
export class DbDumpModule {}
