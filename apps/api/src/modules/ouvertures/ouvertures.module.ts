import { Module } from '@nestjs/common';

import { OuverturesController } from './ouvertures.controller.js';
import { OuverturesService } from './ouvertures.service.js';

@Module({
  controllers: [OuverturesController],
  providers: [OuverturesService],
})
export class OuverturesModule {}
