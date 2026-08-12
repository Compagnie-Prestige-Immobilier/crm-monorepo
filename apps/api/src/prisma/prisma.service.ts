import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient, PrismaPg } from '@crm/database';

import { isOpenApiGeneration, readEnv } from '../env.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: readEnv().DATABASE_URL }),
    });
  }

  async onModuleInit(): Promise<void> {
    // `pnpm openapi:generate` démarre le conteneur Nest entier pour lire les
    // métadonnées Swagger. Sans cette porte, la génération exigerait un
    // Postgres joignable et se bloquerait dès que Docker est arrêté — alors
    // que le document produit ne dépend d'aucune donnée.
    if (isOpenApiGeneration()) {
      this.logger.log('OPENAPI_GENERATION=1 — connexion à la base ignorée');
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (isOpenApiGeneration()) return;
    await this.$disconnect();
  }
}
