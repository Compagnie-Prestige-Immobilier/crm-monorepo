import { Module } from '@nestjs/common';

import { DemoController } from './demo.controller.js';
import { DemoService } from './demo.service.js';

/** Mode démonstration, bascule ADMIN peuplant et retirant un jeu de données. */
@Module({
  controllers: [DemoController],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
