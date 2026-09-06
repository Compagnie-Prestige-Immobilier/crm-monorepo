import { Module } from '@nestjs/common';

import { ChampsConversionController } from './champs-conversion.controller.js';
import { ChampsConversionService } from './champs-conversion.service.js';

@Module({
  controllers: [ChampsConversionController],
  providers: [ChampsConversionService],
  exports: [ChampsConversionService],
})
export class ChampsConversionModule {}
