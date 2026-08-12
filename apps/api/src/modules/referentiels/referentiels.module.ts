import { Module } from '@nestjs/common';

import { ReferentielsController } from './referentiels.controller.js';
import { ReferentielsService } from './referentiels.service.js';

@Module({
  controllers: [ReferentielsController],
  providers: [ReferentielsService],
  exports: [ReferentielsService],
})
export class ReferentielsModule {}
