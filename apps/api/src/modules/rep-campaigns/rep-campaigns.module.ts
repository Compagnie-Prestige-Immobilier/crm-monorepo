import { Module } from '@nestjs/common';

import { RepCampaignsController } from './rep-campaigns.controller.js';
import { RepCampaignsService } from './rep-campaigns.service.js';
import { RepresentantsModule } from '../representants/representants.module.js';

@Module({
  imports: [RepresentantsModule],
  controllers: [RepCampaignsController],
  providers: [RepCampaignsService],
  exports: [RepCampaignsService],
})
export class RepCampaignsModule {}
