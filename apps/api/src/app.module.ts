import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { resolve } from 'node:path';

import { envSchema, readEnv } from './env.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { CacheInterceptor } from './redis/cache.interceptor.js';
import { RedisModule } from './redis/redis.module.js';
import { FreshSessionGuard } from './common/guards/fresh-session.guard.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BankCasesModule } from './modules/bank-cases/bank-cases.module.js';
import { CallbacksModule } from './modules/callbacks/callbacks.module.js';
import { ClientRequestsModule } from './modules/client-requests/client-requests.module.js';
import { DbDumpModule } from './modules/db-dump/db-dump.module.js';
import { DemoModule } from './modules/demo/demo.module.js';
import { EnrolementModule } from './modules/enrolement/enrolement.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OuverturesModule } from './modules/ouvertures/ouvertures.module.js';
import { Phase2Module } from './modules/phase2/phase2.module.js';
import { RepCampaignsModule } from './modules/rep-campaigns/rep-campaigns.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { ExportModule } from './modules/export/export.module.js';
import { ImportsModule } from './modules/imports/imports.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ProspectsModule } from './modules/prospects/prospects.module.js';
import { ReferentielsModule } from './modules/referentiels/referentiels.module.js';
import { RepresentantsModule } from './modules/representants/representants.module.js';
import { SuggestionsModule } from './modules/suggestions/suggestions.module.js';
import { SyncModule } from './modules/sync/sync.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AppUpdatesModule } from './modules/app-updates/app-updates.module.js';
import { VisitesModule } from './modules/visites/visites.module.js';
import { DashboardsModule } from './modules/dashboards/dashboards.module.js';
import { LotsExportModule } from './modules/lots-export/lots-export.module.js';
import { LiveModule } from './modules/live/live.module.js';

const env = readEnv();
const apiLogPath = resolve(import.meta.dirname, '../../../logs/api.log');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        ...(env.NODE_ENV === 'development'
          ? {
              transport: {
                targets: [
                  {
                    target: 'pino-pretty',
                    level: env.LOG_LEVEL,
                    options: { colorize: true, translateTime: 'SYS:standard' },
                  },
                  {
                    target: 'pino/file',
                    level: env.LOG_LEVEL,
                    options: { destination: apiLogPath, mkdir: true },
                  },
                ],
              },
            }
          : {}),
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["idempotency-key"]',
            'res.headers["set-cookie"]',
            'password',
            '*.password',
            'passwordHash',
            '*.passwordHash',
            'token',
            '*.token',
            'accessToken',
            '*.accessToken',
            'refreshToken',
            '*.refreshToken',
            'tokenHash',
            '*.tokenHash',
            'phoneE164',
            '*.phoneE164',
          ],
          censor: '[redacted]',
        },
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: seconds(60), limit: env.API_GLOBAL_RATE_LIMIT }],
    }),
    PrismaModule,
    RedisModule,
    LiveModule,
    AuthModule,
    HealthModule,
    UsersModule,
    ReferentielsModule,
    RepresentantsModule,
    OuverturesModule,
    ProspectsModule,
    SyncModule,
    Phase2Module,
    CallbacksModule,
    RepCampaignsModule,
    SuggestionsModule,
    BankCasesModule,
    ClientRequestsModule,
    DemoModule,
    AdminModule,
    NotificationsModule,
    AnalyticsModule,
    ExportModule,
    AppUpdatesModule,
    DbDumpModule,
    ImportsModule,
    VisitesModule,
    DashboardsModule,
    LotsExportModule,
    EnrolementModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: FreshSessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: CacheInterceptor },
  ],
})
export class AppModule {}
