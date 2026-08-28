import { Module } from '@nestjs/common';
import { ExportModule } from '../export/export.module.js';
import { LotsExportController } from './lots-export.controller.js';
import { LotsExportService } from './lots-export.service.js';
@Module({ imports: [ExportModule], controllers: [LotsExportController], providers: [LotsExportService] })
export class LotsExportModule {}
