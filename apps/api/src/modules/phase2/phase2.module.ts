import { Module } from '@nestjs/common';

import { Phase2Controller } from './phase2.controller.js';
import { Phase2CampaignsService } from './campaigns.service.js';
import { Phase2DirectoryService } from './directory.service.js';
import { Phase2SyncService } from './phase2-sync.service.js';

@Module({
  controllers: [Phase2Controller],
  providers: [Phase2CampaignsService, Phase2DirectoryService, Phase2SyncService],
  exports: [Phase2SyncService, Phase2CampaignsService, Phase2DirectoryService],
})
export class Phase2Module {}
