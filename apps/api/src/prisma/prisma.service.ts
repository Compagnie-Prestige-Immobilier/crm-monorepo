import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient, PrismaPg } from '@crm/database';

import { isOpenApiGeneration, readEnv } from '../env.js';
import type { Workspace } from '../workspaces/workspace.js';

export abstract class PrismaService extends PrismaClient {}

function databaseUrl(workspace: Workspace): string {
  const url = new URL(readEnv().DATABASE_URL);
  url.searchParams.set('schema', workspace);
  if (workspace === 'demo') url.searchParams.set('options', '-csearch_path=demo');
  return url.toString();
}

@Injectable()
export class PrismaClients implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaClients.name);
  private readonly clients: Record<Workspace, PrismaClient>;

  constructor() {
    const poolSize = Math.max(1, Math.floor(readEnv().DATABASE_POOL_SIZE / 2));
    this.clients = {
      public: new PrismaClient({
        adapter: new PrismaPg({ connectionString: databaseUrl('public'), max: poolSize }),
      }),
      demo: new PrismaClient({
        adapter: new PrismaPg({ connectionString: databaseUrl('demo'), max: poolSize }),
      }),
    };
  }

  get(workspace: Workspace): PrismaClient {
    return this.clients[workspace];
  }

  async onModuleInit(): Promise<void> {
    if (isOpenApiGeneration()) {
      this.logger.log('OPENAPI_GENERATION=1, connexion à la base ignorée');
      return;
    }
    await Promise.all(Object.values(this.clients).map((client) => client.$connect()));
    if (readEnv().NODE_ENV !== 'test') await this.assertMigrationParity();
  }

  private async assertMigrationParity(): Promise<void> {
    const applied = async (workspace: Workspace): Promise<string[]> => {
      const rows = await this.clients[workspace].$queryRawUnsafe<{ migration_name: string }[]>(
        `SELECT migration_name FROM ${workspace}."_prisma_migrations" ` +
          'WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name',
      );
      return rows.map((row) => row.migration_name);
    };
    const [publicMigrations, demoMigrations] = await Promise.all([
      applied('public'),
      applied('demo'),
    ]);
    if (publicMigrations.join('\n') !== demoMigrations.join('\n')) {
      throw new Error('Les schémas PostgreSQL public et demo ne portent pas les mêmes migrations.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (isOpenApiGeneration()) return;
    await Promise.all(Object.values(this.clients).map((client) => client.$disconnect()));
  }
}
