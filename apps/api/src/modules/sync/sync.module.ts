import { Module } from '@nestjs/common';

import { HeartbeatModule } from '../heartbeat/heartbeat.module.js';
import { Phase2Module } from '../phase2/phase2.module.js';
import { VisitesModule } from '../visites/visites.module.js';
import { SyncBatchStore } from './batch-store.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

@Module({
  imports: [Phase2Module, HeartbeatModule, VisitesModule],
  controllers: [SyncController],
  providers: [SyncService, SyncBatchStore],
  exports: [SyncService],
})
export class SyncModule {}
