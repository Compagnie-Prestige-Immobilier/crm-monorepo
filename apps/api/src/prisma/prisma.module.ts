import { Global, Module } from '@nestjs/common';

import { WorkspaceContext, workspacePrismaProxy } from '../workspaces/workspace.js';
import { PrismaClients, PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [
    PrismaClients,
    WorkspaceContext,
    {
      provide: PrismaService,
      inject: [PrismaClients, WorkspaceContext],
      useFactory: workspacePrismaProxy,
    },
  ],
  exports: [PrismaService, PrismaClients, WorkspaceContext],
})
export class PrismaModule {}
