import { Global, Module } from '@nestjs/common';

import { readEnv } from '../env.js';
import { WorkspaceContext } from '../workspaces/workspace.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  providers: [
    {
      provide: RedisService,
      inject: [WorkspaceContext],
      useFactory: (workspace: WorkspaceContext) =>
        new RedisService(workspace, RedisService.open(readEnv().REDIS_URL)),
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
