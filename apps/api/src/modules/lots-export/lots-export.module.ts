import { Module } from '@nestjs/common';
import { ChampsConversionModule } from '../champs-conversion/champs-conversion.module.js';
import { LotsExportController } from './lots-export.controller.js';
import { LotsExportService } from './lots-export.service.js';
@Module({
  imports: [ChampsConversionModule],
  controllers: [LotsExportController],
  providers: [LotsExportService],
})
export class LotsExportModule {}
