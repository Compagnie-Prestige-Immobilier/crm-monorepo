import { createHash, randomUUID } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { mkdir, open, readdir, rm, stat, type FileHandle } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationAudience, NotificationCategory, type Prisma } from '@crm/database';
import type { FastifyReply } from 'fastify';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isOpenApiGeneration, readEnv } from '../../env.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  dumpFileName,
  DUMP_TTL_MS,
  effectiveStatus,
  isInFlight,
  STALLED_REASON,
  type DumpJob,
  type DumpStatus,
} from './db-dump.job.js';
import { DUMP_RUNNER, type DumpRunner } from './db-dump.runner.js';
import type { DatabaseDumpJobDto } from './dto.js';

/** L'état vit en base, pas en mémoire : la clé unique EST le verrou « un seul à la fois ». */
const SETTING_KEY = 'admin.database.dump';

const DUMP_CONTENT_TYPE = 'application/gzip';

const AUDIT_REQUESTED = 'DATABASE_DUMP_REQUESTED';
const AUDIT_DOWNLOADED = 'DATABASE_DUMP_DOWNLOADED';

/** Bail de la réservation : un conteneur tué pendant l'envoi réserverait sinon pour l'éternité. */
const RESERVATION_LEASE_MS = 10 * 60 * 1_000;

/** 409 et non 404 : l'archive existe, elle part simplement ailleurs. */
const alreadyDelivering = (): ConflictException =>
  new ConflictException({
    code: 'DATABASE_DUMP_DELIVERING',
    message:
      'Cet export est déjà en cours de téléchargement. Attendez la fin du transfert, ou ' +
      'réessayez dans quelques minutes s’il a été interrompu.',
  });

interface Stored {
  readonly job: DumpJob;
  readonly value: string;
}

function parseJob(raw: string): DumpJob | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const record = value as Partial<DumpJob>;
    if (typeof record.id !== 'string' || typeof record.status !== 'string') return null;
    // `reservedAt` est postérieur : sans ce défaut, une ligne ancienne porte
    // `undefined` et traverse tous les contrôles d'égalité à `null`.
    return { ...record, reservedAt: record.reservedAt ?? null } as DumpJob;
  } catch {
    return null;
  }
}

/**
 * `running` protège son fichier autant que `ready` : `pg_dump` écrit dedans à
 * cet instant. `failed` n'en protège aucun, son fichier partiel doit partir.
 */
const liveFile = (job: DumpJob, now: Date): string | null => {
  if (job.fileName === null) return null;
  const status = effectiveStatus(job, now);
  return status === 'ready' || status === 'running' ? basename(job.fileName) : null;
};

@Injectable()
export class DbDumpService implements OnModuleInit {
  private readonly logger = new Logger(DbDumpService.name);
  private readonly directory = resolve(readEnv().DB_DUMP_DIR);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(DUMP_RUNNER) private readonly runner: DumpRunner,
  ) {}

  /** Rattrape les arrêts brutaux : au démarrage, toute réservation appartient à un processus mort. */
  async onModuleInit(): Promise<void> {
    // Le conteneur est monté sans base pendant `pnpm openapi:generate`.
    if (isOpenApiGeneration()) return;
    try {
      await this.sweep(new Date(), true);
    } catch (error) {
      this.logger.error(
        `Export de la base : réconciliation d’amorçage impossible. ${String(error)}`,
      );
    }
  }

  /** La seule échéance qui survive à un redémarrage : un `setTimeout` ne survit pas. */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'cpi.db-dump.sweep' })
  async sweepExpired(): Promise<void> {
    if (isOpenApiGeneration()) return;
    try {
      await this.sweep();
    } catch (error) {
      this.logger.error(`Export de la base : balayage périodique impossible. ${String(error)}`);
    }
  }

  async state(now = new Date()): Promise<DatabaseDumpJobDto> {
    const current = await this.reconcile(now);
    return this.toDto(current?.job ?? null, now);
  }

  /**
   * Rend immédiatement : un `pg_dump` tient la requête HTTP bien au-delà de ce
   * que le relais Next et le navigateur tolèrent. L'écran sonde `state()`.
   */
  async request(actor: AuthenticatedUser, now = new Date()): Promise<DatabaseDumpJobDto> {
    const existing = await this.reconcile(now);
    if (existing !== null && isInFlight(effectiveStatus(existing.job, now))) {
      return this.toDto(existing.job, now);
    }

    // Une archive prête n'est pas remplacée en silence : cela tuerait le
    // transfert en cours et ferait réattendre celui qui a recliqué par réflexe.
    if (existing !== null && effectiveStatus(existing.job, now) === 'ready') {
      throw new ConflictException({
        code: 'DATABASE_DUMP_ALREADY_READY',
        message:
          'Un export est déjà prêt au téléchargement. Téléchargez-le, ou attendez son ' +
          'échéance, avant d’en demander un autre.',
      });
    }

    const job: DumpJob = {
      id: randomUUID(),
      status: 'queued',
      requestedById: actor.id,
      requestedByName: actor.fullName,
      requestedAt: now.toISOString(),
      startedAt: null,
      finishedAt: null,
      fileName: null,
      fileSize: null,
      sha256: null,
      expiresAt: null,
      reservedAt: null,
      downloadedAt: null,
      failureReason: null,
      noticeStatus: null,
      noticeDetail: null,
    };

    // La prise, et tout le reste en découle : un drapeau en mémoire ne vaudrait
    // que dans un processus, et deux répliques lanceraient deux `pg_dump`.
    if (!(await this.claim(job, actor.id, existing?.value ?? null))) {
      throw new ConflictException({
        code: 'DATABASE_DUMP_IN_PROGRESS',
        message: 'Un export est déjà en cours de démarrage.',
      });
    }

    await this.audit(actor, AUDIT_REQUESTED, { jobId: job.id });

    // Balayer APRÈS la prise : avant, on efface le répertoire sans détenir
    // aucun droit dessus, sous une réplique en plein `pg_dump`.
    await this.sweepOrphans(null);

    // Non attendu, exprès. `catch` obligatoire : un rejet sans gestionnaire fait
    // tomber le processus Node entier.
    void this.execute(job, actor).catch((error: unknown) => {
      this.logger.error(`Export de la base : échec non rattrapé. ${String(error)}`);
    });

    return this.toDto(job, now);
  }

  /**
   * Sert l'archive puis la détruit, mais seulement si la réponse est allée
   * jusqu'au bout : un transfert coupé doit rester reprenable.
   */
  async download(actor: AuthenticatedUser, reply: FastifyReply, now = new Date()): Promise<void> {
    const current = await this.reconcile(now);
    if (
      current === null ||
      effectiveStatus(current.job, now) !== 'ready' ||
      current.job.fileName === null
    ) {
      throw new NotFoundException({
        code: 'DATABASE_DUMP_NOT_READY',
        message: 'Aucun export n’est disponible au téléchargement.',
      });
    }

    const job = current.job;
    // Le nom vient de la ligne écrite par ce service, jamais de la requête, et
    // repasse par `basename` : une valeur corrompue ne doit pas sortir du répertoire.
    const fileName = basename(job.fileName ?? '');
    const path = join(this.directory, fileName);

    // Fastify sert le HEAD de chaque GET par le MÊME gestionnaire : sans cette
    // sortie, une sonde consommerait l'archive sans qu'un octet ne parte.
    if (reply.request.method.toUpperCase() !== 'GET') {
      const probe = await this.openSealed(path);
      if (probe === null) return this.forgetMissingFile(job);
      await probe.handle.close();
      this.setDownloadHeaders(reply, fileName, probe.size);
      await reply.send();
      return;
    }

    // Deux verrous pour deux courses : le contrôle explicite arrête la requête
    // qui voit déjà une réservation, la comparaison-et-échange arbitre les deux
    // qui ont lu la même ligne au même instant. L'un sans l'autre en laisse passer une.
    if (job.reservedAt !== null) throw alreadyDelivering();

    const reserved: DumpJob = { ...job, reservedAt: now.toISOString() };
    if (!(await this.claim(reserved, actor.id, current.value))) throw alreadyDelivering();

    const opened = await this.openSealed(path);
    if (opened === null) {
      return this.forgetMissingFile(reserved);
    }
    const { handle, size } = opened;

    this.setDownloadHeaders(reply, fileName, size);

    // `finish` et non `close` : `close` se déclenche aussi quand la connexion
    // tombe. `once` et non `on` : une seule destruction, une seule ligne d'audit.
    reply.raw.once('finish', () => {
      // L'audit est écrit ICI et pas avant : un flux mort au premier octet
      // laisserait une trace affirmant que l'administrateur détient la base.
      void this.finishDelivery(reserved, actor, fileName, size).catch((error: unknown) => {
        this.logger.error(
          `Export de la base : destruction après envoi impossible. ${String(error)}`,
        );
      });
    });
    reply.raw.once('close', () => {
      if (reply.raw.writableFinished) return;
      // Envoi interrompu : la réservation est relâchée par le seul processus qui
      // sait que les octets ne sont pas tous partis.
      this.logger.warn('Export de la base : téléchargement interrompu, le fichier est conservé.');
      void this.writeOwned({ ...reserved, reservedAt: null }, actor.id).catch(() => undefined);
    });

    await reply.send(handle.createReadStream({ autoClose: true }));
  }

  private setDownloadHeaders(reply: FastifyReply, fileName: string, size: number): void {
    reply.header('Content-Type', DUMP_CONTENT_TYPE);
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    reply.header('Content-Length', String(size));
    reply.header('Cache-Control', 'no-store');

    reply.header('X-Demo-Mode', 'false');
  }

  /**
   * `basename` empêche de sortir du répertoire, pas de suivre un lien symbolique
   * déposé sur le volume. `O_NOFOLLOW` contrôle le descripteur ouvert, sans fenêtre.
   */
  private async openSealed(path: string): Promise<{ handle: FileHandle; size: number } | null> {
    let handle: FileHandle;
    try {
      handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch {
      return null;
    }
    try {
      const info = await handle.stat();
      if (!info.isFile()) {
        this.logger.error(`Export de la base : ${path} n’est pas un fichier ordinaire.`);
        await handle.close();
        return null;
      }
      return { handle, size: info.size };
    } catch {
      await handle.close().catch(() => undefined);
      return null;
    }
  }

  /** La ligne annonce un fichier que le disque n'a pas : on remet l'état d'accord. */
  private async forgetMissingFile(job: DumpJob): Promise<never> {
    await this.expire(job);
    throw new NotFoundException({
      code: 'DATABASE_DUMP_NOT_READY',
      message: 'Le fichier d’export n’est plus disponible. Relancez un export.',
    });
  }

  private async finishDelivery(
    job: DumpJob,
    actor: AuthenticatedUser,
    fileName: string,
    size: number,
  ): Promise<void> {
    await this.audit(actor, AUDIT_DOWNLOADED, {
      jobId: job.id,
      fileName,
      fileSize: size,
      sha256: job.sha256,
    });
    await this.consume(job, actor.id);
  }

  private async execute(job: DumpJob, actor: AuthenticatedUser): Promise<void> {
    const startedAt = new Date();
    const fileName = dumpFileName(job.id, startedAt);
    const path = join(this.directory, fileName);

    // Le nom est publié AVEC `running` : sinon le balayage ne distingue pas le
    // fichier en cours d'écriture d'un orphelin, et l'efface sous `pg_dump`.
    let running: DumpJob = {
      ...job,
      status: 'running',
      startedAt: startedAt.toISOString(),
      fileName,
    };
    // Prise perdue : abandonner AVANT `pg_dump` est la seule issue qui ne laisse
    // rien derrière. On n'écrit même pas `failed`, la ligne est à un autre.
    if (!(await this.writeOwned(running, actor.id))) {
      this.logger.warn(
        `Export de la base ${job.id} : la ligne d’état a changé de main avant le démarrage, ` +
          'l’export est abandonné sans lancer pg_dump.',
      );
      return;
    }

    try {
      await mkdir(this.directory, { recursive: true });
      await this.runner.run(path);
    } catch (error) {
      // Un `.sql.gz` tronqué est indiscernable d'un export valide sur le volume.
      await rm(path, { force: true });
      const reason = error instanceof Error ? error.message : String(error);
      await this.writeOwned(
        {
          ...running,
          status: 'failed',
          finishedAt: new Date().toISOString(),
          failureReason: reason,
        },
        actor.id,
      );
      this.logger.error(`Export de la base demandé par ${actor.username} : échec. ${reason}`);
      return;
    }

    const finishedAt = new Date();
    const fileSize = (await stat(path)).size;
    running = {
      ...running,
      status: 'ready',
      finishedAt: finishedAt.toISOString(),
      fileSize,
      sha256: await this.sha256(path),
      expiresAt: new Date(finishedAt.getTime() + DUMP_TTL_MS).toISOString(),
    };

    // Ligne perdue : plus rien ne nomme ce fichier, donc plus rien ne saurait le
    // servir ni le détruire. On l'efface plutôt que de le laisser orphelin.
    if (!(await this.writeOwned(running, actor.id))) {
      await rm(path, { force: true });
      this.logger.warn(
        `Export de la base ${job.id} : la ligne d’état a changé de main, l’archive est détruite.`,
      );
      return;
    }

    // L'avis part APRÈS `ready` : qui clique dans la seconde doit trouver un fichier.
    const notice = await this.notify(running, actor);
    await this.writeOwned({ ...running, ...notice }, actor.id);
  }

  /**
   * `INBOX_ONLY` est l'issue nominale : la sélection des destinataires e-mail
   * filtre sur `COMMERCIAL`, donc aucun e-mail ne part jamais vers un ADMIN.
   */
  private async notify(
    job: DumpJob,
    actor: AuthenticatedUser,
  ): Promise<{ noticeStatus: string | null; noticeDetail: string | null }> {
    try {
      await this.notifications.create(actor, {
        title: 'Export prêt',
        body: 'Téléchargez-le dans Paramètres > Export intégral.',
        route: '/parametres',
        category: NotificationCategory.SYSTEME,
        audience: NotificationAudience.USERS,
        audienceUserIds: [actor.id],
      });
      return { noticeStatus: 'INBOX_ONLY', noticeDetail: null };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Export de la base : avis de fin non envoyé. ${detail}`);
      return { noticeStatus: 'FAILED', noticeDetail: detail };
    }
  }

  /** Le seul endroit qui détruit sur échéance et qui enterre un travail mort. */
  private async reconcile(now: Date, deliveriesLost = false): Promise<Stored | null> {
    const current = await this.read();
    if (current === null) return null;
    const { job } = current;

    const status = effectiveStatus(job, now);

    if (
      status === 'ready' &&
      job.reservedAt !== null &&
      (deliveriesLost || now.getTime() - Date.parse(job.reservedAt) > RESERVATION_LEASE_MS)
    ) {
      this.logger.warn(
        `Export de la base : réservation abandonnée (${job.id}), l’archive est détruite.`,
      );
      return this.expire(job);
    }

    if (status === job.status) return current;

    if (status === 'expired') return this.expire(job);

    const next: DumpJob = {
      ...job,
      status,
      finishedAt: now.toISOString(),
      failureReason: STALLED_REASON,
      reservedAt: null,
    };
    const value = JSON.stringify(next);
    if (await this.writeOwned(next, null)) return { job: next, value };
    return this.read();
  }

  private async expire(job: DumpJob): Promise<Stored | null> {
    await this.removeFile(job.fileName);
    const next: DumpJob = { ...job, status: 'expired', fileName: null, reservedAt: null };
    const value = JSON.stringify(next);
    if (await this.writeOwned(next, null)) return { job: next, value };
    return this.read();
  }

  async sweep(now = new Date(), deliveriesLost = false): Promise<void> {
    const current = await this.reconcile(now, deliveriesLost);
    await this.sweepOrphans(current === null ? null : liveFile(current.job, now));
  }

  private async consume(job: DumpJob, actorId: string): Promise<void> {
    await this.removeFile(job.fileName);
    await this.writeOwned(
      {
        ...job,
        status: 'expired',
        fileName: null,
        reservedAt: null,
        downloadedAt: new Date().toISOString(),
      },
      actorId,
    );
    this.logger.log(`Export de la base téléchargé puis détruit (${job.id}).`);
  }

  private async removeFile(fileName: string | null): Promise<void> {
    if (fileName === null) return;
    await rm(join(this.directory, basename(fileName)), { force: true });
  }

  private async sweepOrphans(keep: string | null): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(this.directory);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === keep) continue;
      await rm(join(this.directory, entry), { force: true }).catch(() => undefined);
    }
  }

  private async sha256(path: string): Promise<string> {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
    return hash.digest('hex');
  }

  private async read(): Promise<Stored | null> {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    if (!setting) return null;
    const job = parseJob(setting.value);
    return job === null ? null : { job, value: setting.value };
  }

  private async claim(
    next: DumpJob,
    actorId: string | null,
    previous: string | null,
  ): Promise<boolean> {
    const value = JSON.stringify(next);
    if (previous === null) {
      try {
        await this.prisma.appSetting.create({
          data: { key: SETTING_KEY, value, updatedById: actorId },
        });
        return true;
      } catch {
        return false;
      }
    }
    const claimed = await this.prisma.appSetting.updateMany({
      where: { key: SETTING_KEY, value: previous },
      data: { value, updatedById: actorId },
    });
    return claimed.count === 1;
  }

  private async writeOwned(job: DumpJob, actorId: string | null): Promise<boolean> {
    const written = await this.prisma.appSetting.updateMany({
      where: { key: SETTING_KEY, value: { contains: `"id":"${job.id}"` } },
      data: { value: JSON.stringify(job), updatedById: actorId },
    });
    return written.count === 1;
  }

  private async audit(
    actor: AuthenticatedUser,
    action: string,
    payload: Prisma.InputJsonObject,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action,
        entity: 'database',
        entityId: actor.id,
        after: payload,
      },
    });
  }

  private toDto(job: DumpJob | null, now: Date): DatabaseDumpJobDto {
    if (job === null) {
      return {
        id: null,
        status: 'idle',
        requestedByName: null,
        requestedAt: null,
        finishedAt: null,
        fileSize: null,
        sha256: null,
        expiresAt: null,
        failureReason: null,
        noticeStatus: null,
        noticeDetail: null,
        downloadable: false,
      };
    }
    const status: DumpStatus = effectiveStatus(job, now);
    return {
      id: job.id,
      status,
      requestedByName: job.requestedByName,
      requestedAt: job.requestedAt,
      finishedAt: job.finishedAt,
      fileSize: status === 'ready' ? job.fileSize : null,
      sha256: status === 'ready' ? job.sha256 : null,
      expiresAt: status === 'ready' ? job.expiresAt : null,
      failureReason: status === 'failed' ? job.failureReason : null,
      noticeStatus: job.noticeStatus,
      noticeDetail: job.noticeDetail,
      downloadable: status === 'ready',
    };
  }
}
