import { Module } from '@nestjs/common';

import { RepresentantsController } from './representants.controller.js';
import { RepresentantsService } from './representants.service.js';
import { RepresentantsImportService } from './representants-import.service.js';

@Module({
  controllers: [RepresentantsController],
  providers: [RepresentantsService, RepresentantsImportService],
  exports: [RepresentantsService],
})
export class RepresentantsModule {}
