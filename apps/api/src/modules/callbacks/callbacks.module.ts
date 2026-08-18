import { Module } from '@nestjs/common';

import { CallbacksController } from './callbacks.controller.js';
import { CallbacksService } from './callbacks.service.js';

@Module({
  controllers: [CallbacksController],
  providers: [CallbacksService],
})
export class CallbacksModule {}
