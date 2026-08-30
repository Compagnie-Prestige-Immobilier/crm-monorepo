import { Module } from '@nestjs/common';
import { LotsExportController } from './lots-export.controller.js';
import { LotsExportService } from './lots-export.service.js';
@Module({
  controllers: [LotsExportController],
  providers: [LotsExportService],
})
export class LotsExportModule {}
