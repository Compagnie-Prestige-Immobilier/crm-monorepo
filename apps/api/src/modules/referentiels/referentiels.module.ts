import { Module } from '@nestjs/common';

import { CallOutcomeReasonsController } from './call-outcome-reasons.controller.js';
import { CallOutcomeReasonsService } from './call-outcome-reasons.service.js';
import { ReferentielsController } from './referentiels.controller.js';
import { ReferentielsService } from './referentiels.service.js';
import { StatutsQualificationController } from './statuts-qualification.controller.js';
import { StatutsQualificationService } from './statuts-qualification.service.js';

@Module({
  controllers: [
    ReferentielsController,
    CallOutcomeReasonsController,
    StatutsQualificationController,
  ],
  providers: [ReferentielsService, CallOutcomeReasonsService, StatutsQualificationService],
  exports: [ReferentielsService, CallOutcomeReasonsService, StatutsQualificationService],
})
export class ReferentielsModule {}
