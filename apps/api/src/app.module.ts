import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { envSchema, readEnv } from './env.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { DemoModeInterceptor } from './common/interceptors/demo-mode.interceptor.js';
import { DemoReadOnlyGuard } from './common/guards/demo-read-only.guard.js';
import { FreshSessionGuard } from './common/guards/fresh-session.guard.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BankCasesModule } from './modules/bank-cases/bank-cases.module.js';
import { ClientRequestsModule } from './modules/client-requests/client-requests.module.js';
import { DbDumpModule } from './modules/db-dump/db-dump.module.js';
import { DemoModule } from './modules/demo/demo.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { Phase2Module } from './modules/phase2/phase2.module.js';
import { RepCampaignsModule } from './modules/rep-campaigns/rep-campaigns.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { ExportModule } from './modules/export/export.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ProspectsModule } from './modules/prospects/prospects.module.js';
import { ReferentielsModule } from './modules/referentiels/referentiels.module.js';
import { RepresentantsModule } from './modules/representants/representants.module.js';
import { SyncModule } from './modules/sync/sync.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AppUpdatesModule } from './modules/app-updates/app-updates.module.js';

const env = readEnv();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
        // Les jokers comptent : `password` seul ne couvre qu'une clé racine,
        // et un corps ou un en-tête imbriqué passerait à travers. Cette liste
        // est la dernière ligne de défense, pas la première, les corps de
        // requête ne sont pas journalisés.
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
    AuthModule,
    HealthModule,
    UsersModule,
    ReferentielsModule,
    RepresentantsModule,
    ProspectsModule,
    SyncModule,
    Phase2Module,
    RepCampaignsModule,
    BankCasesModule,
    ClientRequestsModule,
    DemoModule,
    AdminModule,
    NotificationsModule,
    AnalyticsModule,
    ExportModule,
    AppUpdatesModule,
    DbDumpModule,
  ],
  providers: [
    // L'ordre compte. Le throttler s'applique avant toute lecture de base ;
    // JwtAuthGuard renseigne `request.user`, que RolesGuard lit ensuite. Les
    // cinq sont globaux : une route qui oublie un décorateur est refusée,
    // pas exposée.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // ENTRE les deux, et l'ordre est la correction elle-même. Le jeton PORTE le
    // rôle : il dit ce qui était vrai à l'émission, et le répète pendant quinze
    // minutes. `FreshSessionGuard` relit l'autorité en base sur les routes qui
    // en exigent une, et écrase `request.user` AVANT que `RolesGuard` ne
    // tranche. Sans lui, rétrograder un ADMIN ne lui retirait rien jusqu'à
    // l'expiration de son jeton, et un jeton de démonstration survivait à
    // l'extinction du mode.
    { provide: APP_GUARD, useClass: FreshSessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // EN DERNIER, délibérément. Une requête sans jeton doit repartir en 401,
    // pas en 409 : le mode démonstration n'est pas une raison de renseigner un
    // anonyme sur l'état interne du serveur. Cette garde suspend les écritures
    // interactives pendant une démonstration ; la remontée hors ligne du
    // mobile en est dispensée, voir `DemoWritable`.
    { provide: APP_GUARD, useClass: DemoReadOnlyGuard },
    // Estampille `X-Demo-Mode` sur toute réponse non détournée : une capture
    // d'écran de statistiques prise pendant une démonstration circule ensuite
    // sans la bannière qui l'accompagnait.
    { provide: APP_INTERCEPTOR, useClass: DemoModeInterceptor },
  ],
})
export class AppModule {}
