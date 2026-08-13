import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller.js';
import { PurgeService } from './purge.service.js';
import { SupervisionService } from './supervision.service.js';

/** Purge de la base et supervision des comptes. ADMIN uniquement. */
@Module({
  controllers: [AdminController],
  providers: [PurgeService, SupervisionService],
  exports: [PurgeService, SupervisionService],
})
export class AdminModule {}
