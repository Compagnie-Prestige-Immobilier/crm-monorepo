import { Global, Module } from '@nestjs/common';

import { LiveController } from './live.controller.js';
import { LiveService } from './live.service.js';

@Global()
@Module({
  controllers: [LiveController],
  providers: [LiveService],
  exports: [LiveService],
})
export class LiveModule {}
