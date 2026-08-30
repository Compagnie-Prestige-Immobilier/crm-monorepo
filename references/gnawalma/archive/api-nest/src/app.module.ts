import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { MediaModule } from './media/media.module';
import { OperationsModule } from './operations/operations.module';
import { SyncModule } from './sync/sync.module';
import { AdminModule } from './admin/admin.module';
import { AtelierModule } from './atelier/atelier.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    DatabaseModule,
    AtelierModule,
    AuthModule,
    MarketplaceModule,
    MediaModule,
    OperationsModule,
    SyncModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
