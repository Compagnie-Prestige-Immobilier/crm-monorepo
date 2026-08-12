import { Module } from '@nestjs/common';

import { ProspectsController } from './prospects.controller.js';
import { ProspectsService } from './prospects.service.js';

@Module({
  controllers: [ProspectsController],
  providers: [ProspectsService],
  exports: [ProspectsService],
})
export class ProspectsModule {}
