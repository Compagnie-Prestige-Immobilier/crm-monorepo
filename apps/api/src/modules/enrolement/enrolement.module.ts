import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { EnrolementController } from './enrolement.controller.js';
import { EnrolementService } from './enrolement.service.js';
import { EnrolementIndicateursService } from './indicateurs.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [EnrolementController],
  providers: [EnrolementService, EnrolementIndicateursService],
})
export class EnrolementModule {}
