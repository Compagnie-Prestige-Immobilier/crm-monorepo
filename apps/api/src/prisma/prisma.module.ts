import { Global, Module } from '@nestjs/common';

import { DemoVisibilityService } from './demo-visibility.service.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService, DemoVisibilityService],
  exports: [PrismaService, DemoVisibilityService],
})
export class PrismaModule {}
