import { Module } from '@nestjs/common';

import { ProspectsController } from './prospects.controller.js';
import { ProspectsService } from './prospects.service.js';
import { SegmentChangeService } from './segment-change.service.js';

@Module({
  controllers: [ProspectsController],
  providers: [ProspectsService, SegmentChangeService],
  exports: [ProspectsService, SegmentChangeService],
})
export class ProspectsModule {}
