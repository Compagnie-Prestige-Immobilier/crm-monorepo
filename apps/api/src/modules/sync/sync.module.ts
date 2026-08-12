import { Module } from '@nestjs/common';

import { Phase2Module } from '../phase2/phase2.module.js';
import { SyncBatchStore } from './batch-store.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

// Phase2Module est importé pour son seul `Phase2SyncService` : les règles de
// phase 2 restent définies à un seul endroit, et le push ne fait que les
// appeler depuis sa propre transaction.
@Module({
  imports: [Phase2Module],
  controllers: [SyncController],
  providers: [SyncService, SyncBatchStore],
  exports: [SyncService],
})
export class SyncModule {}
