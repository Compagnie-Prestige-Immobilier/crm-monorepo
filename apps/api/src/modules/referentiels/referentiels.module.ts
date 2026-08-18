import { Module } from '@nestjs/common';

import { CallOutcomeReasonsController } from './call-outcome-reasons.controller.js';
import { CallOutcomeReasonsService } from './call-outcome-reasons.service.js';
import { ReferentielsController } from './referentiels.controller.js';
import { ReferentielsService } from './referentiels.service.js';

@Module({
  controllers: [ReferentielsController, CallOutcomeReasonsController],
  providers: [ReferentielsService, CallOutcomeReasonsService],
  exports: [ReferentielsService, CallOutcomeReasonsService],
})
export class ReferentielsModule {}
