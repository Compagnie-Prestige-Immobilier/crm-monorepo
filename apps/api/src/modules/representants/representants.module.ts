import { Module } from '@nestjs/common';

import { RepresentantsController } from './representants.controller.js';
import { RepresentantsService } from './representants.service.js';

@Module({
  controllers: [RepresentantsController],
  providers: [RepresentantsService],
  exports: [RepresentantsService],
})
export class RepresentantsModule {}
