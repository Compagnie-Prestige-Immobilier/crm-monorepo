import { Module } from '@nestjs/common';

import { ParametresChuesController } from './parametres-chues.controller.js';
import { ParametresChuesService } from './parametres-chues.service.js';

@Module({
  controllers: [ParametresChuesController],
  providers: [ParametresChuesService],
  exports: [ParametresChuesService],
})
export class ParametresChuesModule {}
