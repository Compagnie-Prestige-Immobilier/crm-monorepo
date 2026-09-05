import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { Projet } from '@crm/database';

import { readEnv } from '../../env.js';
import { EnrolementController } from './enrolement.controller.js';
import {
  ENROLEMENT_CONFIG,
  EnrolementService,
  type ConfigEnrolement,
} from './enrolement.service.js';
import { EnrolementIndicateursService } from './indicateurs.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [EnrolementController],
  providers: [
    EnrolementService,
    EnrolementIndicateursService,
    {
      provide: ENROLEMENT_CONFIG,
      useFactory: (): ConfigEnrolement => {
        const env = readEnv();
        return {
          [Projet.CHUES]: {
            url: env.PLATEFORME_CHUES_URL,
            token: env.PLATEFORME_CHUES_TOKEN,
          },
          [Projet.GRAND_PUBLIC]: {
            url: env.PLATEFORME_GRAND_PUBLIC_URL,
            token: env.PLATEFORME_GRAND_PUBLIC_TOKEN,
          },
        };
      },
    },
  ],
})
export class EnrolementModule {}
