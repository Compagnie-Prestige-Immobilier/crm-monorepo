import { Module } from '@nestjs/common';

import { ReferentielsModule } from '../referentiels/referentiels.module.js';

import { Phase2Controller } from './phase2.controller.js';
import { Phase2DirectoryService } from './directory.service.js';
import { Phase2SyncService } from './phase2-sync.service.js';
import { CallRecordingsService } from './recordings.service.js';

@Module({
  imports: [ReferentielsModule],
  controllers: [Phase2Controller],
  providers: [
    Phase2DirectoryService,
    Phase2SyncService,
    CallRecordingsService,
  ],
  exports: [Phase2SyncService, Phase2DirectoryService],
})
export class Phase2Module {}
