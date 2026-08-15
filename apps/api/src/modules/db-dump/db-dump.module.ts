import { Module } from '@nestjs/common';

import { readEnv } from '../../env.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DbDumpController } from './db-dump.controller.js';
import { DbDumpEnabledGuard } from './db-dump-enabled.guard.js';
import { DbDumpService } from './db-dump.service.js';
import { DUMP_RUNNER, PgDumpRunner } from './db-dump.runner.js';

/**
 * Export intégral de la base. ADMIN uniquement.
 *
 * `NotificationsModule` est importé pour son `NotificationsService` : l'avis de
 * fin passe par la boîte de réception ET par Brevo, et les deux sont déjà
 * câblés là-bas. Écrire un second expéditeur ici dupliquerait le découpage en
 * lots, la classification des échecs et le mode dégradé sans clé.
 *
 * `PrismaModule` est global : il n'a pas à figurer dans les imports.
 *
 * Le lanceur est fourni par un JETON et non par sa classe. C'est ce qui rend le
 * module exerçable : les tests substituent une doublure qui écrit une petite
 * archive, et tout le reste (états, unicité, échéance, audit, avis, service du
 * fichier) est éprouvé pour de vrai, sans `pg_dump` ni Postgres.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [DbDumpController],
  providers: [
    DbDumpService,
    // Déclarée en fournisseur bien qu'elle soit posée par `@UseGuards` : Nest
    // sait instancier une garde sans dépendance, mais la déclarer la rend
    // substituable dans les montages d'essai, où l'interrupteur doit pouvoir
    // être basculé dans les deux sens.
    DbDumpEnabledGuard,
    { provide: DUMP_RUNNER, useFactory: () => new PgDumpRunner(readEnv().DATABASE_URL) },
  ],
})
export class DbDumpModule {}
