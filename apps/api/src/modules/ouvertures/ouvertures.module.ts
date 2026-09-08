import { Module } from '@nestjs/common';

import { ParametresChuesModule } from '../parametres-chues/parametres-chues.module.js';
import { OuverturesController } from './ouvertures.controller.js';
import { OuverturesService } from './ouvertures.service.js';

@Module({
  imports: [ParametresChuesModule],
  controllers: [OuverturesController],
  providers: [OuverturesService],
})
export class OuverturesModule {}
