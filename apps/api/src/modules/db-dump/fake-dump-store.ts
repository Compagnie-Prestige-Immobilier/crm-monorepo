import { createWriteStream } from 'node:fs';
import { Global, Module, VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Role } from '@crm/database';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { DbDumpController } from './db-dump.controller.js';
import { DbDumpService } from './db-dump.service.js';
import { DUMP_RUNNER, type DumpRunner } from './db-dump.runner.js';

/**
 * Montage d'essai de l'export intégral.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUI EST DOUBLÉ, ET CE QUI NE L'EST PAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * DOUBLÉ : `pg_dump` (il exige un binaire et un Postgres), `app_settings` et
 * `audit_logs` (une base), et l'envoi de notification (un compte Brevo).
 *
 * PAS DOUBLÉ, et c'est le point : le service lui-même, le contrôleur, le
 * routage Fastify, l'écriture RÉELLE de fichiers sur le disque, leur
 * destruction, le calcul du sha256, le flux de téléchargement. La doublure de
 * `pg_dump` écrit une VRAIE archive gzip dans le répertoire des exports ; tout
 * ce que le service en fait ensuite est exercé pour de bon.
 *
 * `FakeDumpStore` MÉMORISE ce qu'on lui écrit au lieu de rendre une valeur
 * figée. C'est indispensable : la moitié des tests consiste à écrire un état,
 * puis à vérifier qu'une seconde requête le relit et se comporte en
 * conséquence. Une doublure qui rendrait toujours la même ligne ne saurait pas
 * distinguer « refusé » de « enregistré puis relu ».
 */

const SETTING_KEY = 'admin.database.dump';

export interface AuditRow {
  userId: string | null;
  action: string;
  entity: string;
  entityId: string;
  after: unknown;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA DOUBLURE APPLIQUE LES PRÉDICATS. C'EST TOUT L'INTÉRÊT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `create` refuse une clé déjà présente, et `updateMany` n'écrit QUE si son
 * `where` correspond, en rendant le nombre de lignes touchées. Sans cela, les
 * écritures conditionnelles du service (la prise du travail, la réservation du
 * téléchargement, l'écriture réservée au propriétaire de la ligne) réussiraient
 * toujours dans les tests, et les courses qu'elles existent pour arbitrer
 * seraient exactement les seules choses qu'aucun test ne verrait.
 *
 * Une doublure permissive fait passer les tests d'un verrou qui n'en est pas un.
 */
export class FakeDumpStore {
  private value: string | null = null;
  readonly audits: AuditRow[] = [];

  /**
   * Posé pendant l'écriture conditionnelle, pour entrelacer deux appelants.
   *
   * C'est ce qui permet d'éprouver une VRAIE course : deux `request()` lancés
   * ensemble, dont le second lit l'état pendant que le premier est suspendu
   * juste avant d'écrire. Sans ce crochet, deux appels séquentiels ne
   * prouveraient rien, la première écriture étant déjà commise.
   */
  onBeforeConditionalWrite: (() => Promise<void>) | null = null;

  readonly appSetting = {
    findUnique: ({ where }: { where: { key: string } }): Promise<{ value: string } | null> =>
      Promise.resolve(
        where.key === SETTING_KEY && this.value !== null ? { value: this.value } : null,
      ),

    /** La clé est la clé primaire : un second insérant échoue, comme en base. */
    create: ({ data }: { data: { key: string; value: string } }): Promise<{ value: string }> => {
      if (this.value !== null) {
        return Promise.reject(new Error('Unique constraint failed on the fields: (`key`)'));
      }
      this.value = data.value;
      return Promise.resolve({ value: data.value });
    },

    updateMany: async ({
      where,
      data,
    }: {
      where: { key: string; value?: string | { contains: string } };
      data: { value: string };
    }): Promise<{ count: number }> => {
      const hook = this.onBeforeConditionalWrite;
      if (hook !== null) {
        // Une seule fois : le crochet sert à ouvrir la fenêtre, pas à suspendre
        // toutes les écritures qui suivent.
        this.onBeforeConditionalWrite = null;
        await hook();
      }
      if (where.key !== SETTING_KEY || this.value === null) return { count: 0 };

      const expected = where.value;
      if (typeof expected === 'string' && this.value !== expected) return { count: 0 };
      if (
        expected !== undefined &&
        typeof expected === 'object' &&
        !this.value.includes(expected.contains)
      ) {
        return { count: 0 };
      }

      this.value = data.value;
      return { count: 1 };
    },

    upsert: ({ create }: { create: { value: string } }): Promise<{ value: string }> => {
      this.value = create.value;
      return Promise.resolve({ value: create.value });
    },
  };

  readonly auditLog = {
    create: ({ data }: { data: AuditRow }): Promise<AuditRow> => {
      this.audits.push(data);
      return Promise.resolve(data);
    },
  };

  /** Écrit l'état directement, sans passer par les routes. */
  seed(job: Record<string, unknown>): void {
    this.value = JSON.stringify(job);
  }

  stored(): Record<string, unknown> | null {
    return this.value === null ? null : (JSON.parse(this.value) as Record<string, unknown>);
  }

  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}

/**
 * Doublure de `pg_dump` : elle écrit une VRAIE archive gzip.
 *
 * Le contenu importe peu, sa validité si : le service en calcule le sha256, en
 * lit la taille, puis le sert en flux. Un fichier bidon de zéro octet ferait
 * passer un service qui n'écrirait jamais rien.
 */
export class FakeDumpRunner implements DumpRunner {
  calls = 0;
  /** Quand elle est posée, le lanceur échoue avec cette phrase. */
  failWith: string | null = null;
  /** Retenue jusqu'à ce qu'on la relâche, pour observer l'état « running ». */
  private gate: Promise<void> | null = null;
  private open: (() => void) | null = null;

  hold(): void {
    this.gate = new Promise<void>((resolve) => {
      this.open = resolve;
    });
  }

  release(): void {
    this.open?.();
    this.gate = null;
    this.open = null;
  }

  async run(destination: string): Promise<void> {
    this.calls += 1;
    if (this.gate !== null) await this.gate;
    if (this.failWith !== null) throw new Error(this.failWith);
    await pipeline(
      Readable.from(['-- export CPI GO\nCREATE TABLE prospects (id uuid);\n']),
      createGzip(),
      createWriteStream(destination),
    );
  }
}

/** Doublure de l'avis de fin. Elle enregistre ce qui lui a été demandé. */
export class FakeNotifications {
  readonly sent: { title: string; body: string; audienceUserIds?: string[] }[] = [];
  transportStatus: string | null = 'SENT';
  throwWith: string | null = null;

  create(
    _user: AuthenticatedUser,
    body: { title: string; body: string; audienceUserIds?: string[] },
  ): Promise<{ transportStatus: string | null }> {
    if (this.throwWith !== null) return Promise.reject(new Error(this.throwWith));
    this.sent.push(body);
    return Promise.resolve({ transportStatus: this.transportStatus });
  }

  asService(): NotificationsService {
    return this as unknown as NotificationsService;
  }
}

export const FAKE_ADMIN: AuthenticatedUser = {
  id: '0199a000-0000-7000-8000-000000000001',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Admin CPI',
  role: Role.ADMIN,
};

export interface DumpHarness {
  app: NestFastifyApplication;
  store: FakeDumpStore;
  runner: FakeDumpRunner;
  notifications: FakeNotifications;
}

/**
 * Monte l'application RÉELLE sur l'adaptateur Fastify, avec le préfixe et la
 * version de production.
 *
 * Le contrôleur est déclaré ici plutôt qu'en important `DbDumpModule` : ce
 * dernier importe `NotificationsModule`, donc l'ordonnanceur de rappels et
 * l'ensemble de la chaîne de notification. On veut exercer CE module, pas
 * démarrer le reste de l'API.
 */
export async function createDumpApp(harness: {
  store: FakeDumpStore;
  runner: FakeDumpRunner;
  notifications: FakeNotifications;
}): Promise<NestFastifyApplication> {
  @Global()
  @Module({
    providers: [{ provide: PrismaService, useValue: harness.store.asService() }],
    exports: [PrismaService],
  })
  class FakePrismaModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [FakePrismaModule],
    controllers: [DbDumpController],
    providers: [
      DbDumpService,
      { provide: NotificationsService, useValue: harness.notifications.asService() },
      { provide: DUMP_RUNNER, useValue: harness.runner },
    ],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });

  // Le montage n'embarque pas les gardes globales : sans cette identité,
  // `@CurrentUser()` lèverait avant même d'atteindre le service.
  const instance: FastifyInstance = app.getHttpAdapter().getInstance();
  instance.addHook(
    'onRequest',
    (request: FastifyRequest, _reply: FastifyReply, done: () => void) => {
      (request as FastifyRequest & { user?: AuthenticatedUser }).user = FAKE_ADMIN;
      done();
    },
  );

  await app.init();
  await instance.ready();
  return app;
}
