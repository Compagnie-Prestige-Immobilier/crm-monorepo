import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationAudience, NotificationCategory, type Prisma } from '@crm/database';
import type { FastifyReply } from 'fastify';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { readEnv } from '../../env.js';
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

/**
 * Export intégral de la base, depuis les paramètres.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CE FICHIER PRODUIT, ET POURQUOI TOUT LE RESTE EN DÉCOULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un `.sql.gz` contenant la base ENTIÈRE : le nom et le numéro de téléphone de
 * chaque prospect, le montant en francs CFA de chaque dossier bancaire, les
 * comptes et leurs empreintes de mots de passe. Des personnes réelles, au
 * Sénégal. Ce n'est pas un export de travail, c'est un second exemplaire de
 * l'entreprise.
 *
 * LES CINQ VERROUS, ET AUCUN N'EST DÉCORATIF :
 *
 * 1. ADMIN. Posé sur le contrôleur.
 *
 * 2. PAS PENDANT UNE DÉMONSTRATION. Rien n'est écrit ici pour l'obtenir :
 *    `DemoReadOnlyGuard` refuse toute méthode mutante tant que l'interrupteur
 *    est allumé, et la demande est un POST. La route ne porte donc PAS
 *    `@DemoWritable`, et c'est la décision, pas un oubli. Un export pris
 *    pendant une démonstration contiendrait les milliers de lignes fictives que
 *    le semeur vient d'écrire, mêlées aux vraies, dans un fichier qui a toutes
 *    les apparences d'un export de production. Le TÉLÉCHARGEMENT, lui, est un
 *    GET : il reste possible, ce qui est correct, puisqu'un fichier prêt a
 *    nécessairement été produit hors démonstration.
 *
 * 3. AUCUN LIEN NE VOYAGE. L'avis de fin ne contient pas d'URL, pas de jeton,
 *    pas de pièce jointe : il dit que l'export est prêt et invite à se
 *    connecter. Le téléchargement se fait dans la session authentifiée de
 *    l'administrateur, par une route ADMIN ordinaire. Une boîte aux lettres
 *    compromise ou un message transféré ne donne donc accès à RIEN.
 *
 * 4. LE FICHIER NE SURVIT PAS. Détruit dès qu'il a été téléchargé, et de toute
 *    façon à l'échéance (voir `DUMP_TTL_MS`). Dans le cas nominal il vit
 *    quelques minutes.
 *
 * 5. TOUT EST TRACÉ. La demande et le téléchargement écrivent chacun une ligne
 *    dans `audit_logs`, nommant l'administrateur. Le même journal que la purge.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OÙ VIT L'ÉTAT, ET POURQUOI PAS EN MÉMOIRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dans `app_settings`, sous une clé unique, exactement comme la release Android
 * (`mobile.android.release`). Deux raisons, et aucune n'est le confort :
 *
 *  - Le fichier vit sur un VOLUME, donc il survit à un redéploiement. Un état
 *    en mémoire, lui, ne survivrait pas : l'écran repartirait de zéro devant un
 *    fichier bien présent, que plus rien ne saurait ni servir ni détruire. Un
 *    exemplaire complet de la clientèle deviendrait orphelin sur le disque.
 *  - Une clé unique EST le verrou d'unicité. « Un seul export à la fois » n'est
 *    pas une règle qu'on vérifie, c'est la forme de la donnée.
 *
 * Aucune migration n'est demandée pour autant : `app_settings` existe, et
 * ajouter une table pour une ligne qui vit quelques heures coûterait plus cher
 * que ce qu'elle rapporte.
 */

/** La clé unique. Un seul export à la fois, par construction. */
const SETTING_KEY = 'admin.database.dump';

/** Type MIME de l'archive. Rien qu'un navigateur tenterait d'afficher. */
const DUMP_CONTENT_TYPE = 'application/gzip';

const AUDIT_REQUESTED = 'DATABASE_DUMP_REQUESTED';
const AUDIT_DOWNLOADED = 'DATABASE_DUMP_DOWNLOADED';

@Injectable()
export class DbDumpService {
  private readonly logger = new Logger(DbDumpService.name);
  private readonly directory = resolve(readEnv().DB_DUMP_DIR);

  /**
   * Verrou DANS LE PROCESSUS, en complément de la clé unique.
   *
   * Deux POST arrivés à la même milliseconde liraient tous deux « aucun export
   * en cours » avant que le premier n'ait écrit son état, et deux `pg_dump`
   * partiraient sur la même base. Ce drapeau ferme la fenêtre. Il ne remplace
   * pas l'état persisté, qui est le seul à survivre à un redémarrage : c'est
   * l'inverse, l'un couvre les millisecondes, l'autre les heures.
   */
  private starting = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(DUMP_RUNNER) private readonly runner: DumpRunner,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Lecture
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * L'état courant, RÉCONCILIÉ avec l'horloge.
   *
   * C'est ce que l'écran sonde. La réconciliation a lieu ICI et non dans une
   * tâche planifiée : le module n'a alors aucun ordonnanceur à posséder, et
   * surtout un fichier échu est détruit au premier regard porté sur lui, ce qui
   * est le moment où cela compte.
   *
   * Un ordonnanceur reste souhaitable pour le cas où PERSONNE ne regarde
   * pendant des jours ; le minuteur armé à la fin de l'export le couvre tant
   * que le processus vit, et la demande suivante balaie ce qui traîne. C'est
   * assumé, pas oublié.
   */
  async state(now = new Date()): Promise<DatabaseDumpJobDto> {
    const job = await this.reconcile(now);
    return this.toDto(job, now);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Demande
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Demande un export. Rend IMMÉDIATEMENT.
   *
   * Le travail part en arrière-plan, délibérément non attendu : un `pg_dump`
   * tient la requête HTTP ouverte pendant des minutes, et le relais Next comme
   * le navigateur la coupent bien avant. L'écran sonde `state()`.
   *
   * Un export DÉJÀ EN COURS est RENDU tel quel, sans en démarrer un second.
   * C'est la réponse utile : celui qui reclique veut son fichier, pas une
   * seconde copie de la base sur le même disque.
   */
  async request(actor: AuthenticatedUser, now = new Date()): Promise<DatabaseDumpJobDto> {
    const existing = await this.reconcile(now);
    if (existing !== null && isInFlight(existing.status)) return this.toDto(existing, now);
    if (this.starting) {
      throw new ConflictException({
        code: 'DATABASE_DUMP_IN_PROGRESS',
        message: 'Un export est déjà en cours de démarrage.',
      });
    }
    this.starting = true;

    try {
      // Balayage AVANT de commencer : un fichier laissé par un travail dont
      // l'état a été perdu (redéploiement en plein export) doit disparaître, et
      // c'est le seul moment où l'on sait qu'aucun export n'est en cours et
      // qu'aucun fichier n'est donc légitimement ouvert.
      await this.sweepOrphans(null);

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
        downloadedAt: null,
        failureReason: null,
        noticeStatus: null,
        noticeDetail: null,
      };
      await this.write(job, actor.id);
      await this.audit(actor, AUDIT_REQUESTED, { jobId: job.id });

      // Non attendu, EXPRÈS. `void` et un `catch` : une promesse rejetée sans
      // gestionnaire ferait tomber le processus Node entier.
      void this.execute(job, actor).catch((error: unknown) => {
        this.logger.error(`Export de la base : échec non rattrapé. ${String(error)}`);
      });

      return this.toDto(job, now);
    } finally {
      this.starting = false;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Téléchargement
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Sert l'archive, puis la détruit.
   *
   * LA ROUTE NE PREND AUCUN PARAMÈTRE. Le nom du fichier vient de la ligne
   * `app_settings`, écrite par ce service, et il repasse par `basename` avant
   * d'être joint au répertoire : même une valeur corrompue en base ne peut pas
   * faire sortir la lecture du répertoire des exports. Un chemin dérivé de la
   * requête, sur une route qui sert la base entière, serait la faute la plus
   * chère du dépôt.
   *
   * La destruction n'a lieu QUE si la réponse est allée jusqu'au bout
   * (`writableFinished`). Un téléchargement coupé au deux tiers, sur une
   * liaison mobile, ne doit pas emporter le fichier : l'administrateur
   * recommencerait, et il n'y aurait plus rien à reprendre.
   */
  async download(actor: AuthenticatedUser, reply: FastifyReply, now = new Date()): Promise<void> {
    const job = await this.reconcile(now);
    if (job === null || effectiveStatus(job, now) !== 'ready' || job.fileName === null) {
      throw new NotFoundException({
        code: 'DATABASE_DUMP_NOT_READY',
        message: 'Aucun export n’est disponible au téléchargement.',
      });
    }

    const fileName = basename(job.fileName);
    const path = join(this.directory, fileName);
    let size: number;
    try {
      size = (await stat(path)).size;
    } catch {
      // La base annonce un fichier que le disque n'a pas : on le dit, et on
      // remet l'état d'accord avec la réalité plutôt que de laisser l'écran
      // proposer indéfiniment un téléchargement impossible.
      await this.write({ ...job, status: 'expired', fileName: null }, actor.id);
      throw new NotFoundException({
        code: 'DATABASE_DUMP_NOT_READY',
        message: 'Le fichier d’export n’est plus disponible. Relancez un export.',
      });
    }

    await this.audit(actor, AUDIT_DOWNLOADED, {
      jobId: job.id,
      fileName,
      fileSize: size,
      sha256: job.sha256,
    });

    reply.header('Content-Type', DUMP_CONTENT_TYPE);
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    reply.header('Content-Length', String(size));
    // Un export de la clientèle ne doit rester dans aucun cache intermédiaire.
    reply.header('Cache-Control', 'no-store');

    // `finish` et NON `close`. `finish` ne se déclenche que lorsque la réponse
    // a été entièrement écrite ; `close` se déclenche AUSSI quand la connexion
    // tombe, et détruirait alors le fichier au beau milieu d'un téléchargement
    // coupé par une liaison mobile. L'administrateur relancerait, et il n'y
    // aurait plus rien à reprendre.
    reply.raw.on('finish', () => {
      void this.consume(job, actor.id).catch((error: unknown) => {
        this.logger.error(
          `Export de la base : destruction après envoi impossible. ${String(error)}`,
        );
      });
    });
    reply.raw.on('close', () => {
      if (!reply.raw.writableFinished) {
        this.logger.warn('Export de la base : téléchargement interrompu, le fichier est conservé.');
      }
    });

    await reply.send(createReadStream(path));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Exécution
  // ───────────────────────────────────────────────────────────────────────────

  private async execute(job: DumpJob, actor: AuthenticatedUser): Promise<void> {
    const startedAt = new Date();
    let running: DumpJob = { ...job, status: 'running', startedAt: startedAt.toISOString() };
    await this.write(running, actor.id);

    const fileName = dumpFileName(job.id, startedAt);
    const path = join(this.directory, fileName);

    try {
      await mkdir(this.directory, { recursive: true });
      await this.runner.run(path);
    } catch (error) {
      // Le fichier partiel est effacé : un `.sql.gz` tronqué serait
      // indiscernable d'un export valide pour qui le trouverait sur le volume.
      await rm(path, { force: true });
      const reason = error instanceof Error ? error.message : String(error);
      await this.write(
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
      fileName,
      fileSize,
      sha256: await this.sha256(path),
      expiresAt: new Date(finishedAt.getTime() + DUMP_TTL_MS).toISOString(),
    };
    await this.write(running, actor.id);

    // L'avis part APRÈS que l'état soit prêt : l'administrateur qui clique dans
    // la seconde qui suit la réception doit trouver un fichier téléchargeable,
    // et non un écran qui dit encore « en cours ».
    const notice = await this.notify(running, actor);
    await this.write({ ...running, ...notice }, actor.id);

    // Minuteur de destruction. `unref` : il ne doit pas retenir le processus à
    // l'arrêt. Il ne survit pas à un redémarrage, et c'est pour cela qu'il
    // n'est PAS le mécanisme d'échéance : `effectiveStatus` l'est. Celui-ci
    // n'est qu'un raccourci pour le cas courant, où personne ne rouvre l'écran.
    setTimeout(() => {
      void this.reconcile(new Date()).catch(() => undefined);
    }, DUMP_TTL_MS).unref();
  }

  /**
   * Avis de fin, sur les DEUX canaux, sans le moindre lien.
   *
   * `NotificationsService.create` est réutilisé tel quel : il écrit la ligne de
   * boîte de réception (la cloche du panel, que l'administrateur voit sans
   * quitter son écran) ET déclenche l'e-mail par Brevo. Écrire un second envoi
   * ici dupliquerait le transport, sa gestion des lots, ses classifications
   * d'échec et son mode dégradé.
   *
   * L'ÉCHEC DE L'AVIS N'EST PAS L'ÉCHEC DE L'EXPORT. Le fichier est prêt ; il
   * le reste. Ce qui serait inacceptable, c'est de n'en rien dire : l'issue est
   * donc RENDUE et enregistrée dans l'état, où l'écran la lit. Sans compte
   * Brevo, l'export aboutit, la cloche sonne, et l'état porte
   * `NOT_CONFIGURED`.
   */
  private async notify(
    job: DumpJob,
    actor: AuthenticatedUser,
  ): Promise<{ noticeStatus: string | null; noticeDetail: string | null }> {
    try {
      const created = await this.notifications.create(actor, {
        title: 'Export de la base prêt',
        body:
          'L’export intégral que vous avez demandé est terminé. Connectez-vous au ' +
          'panel, ouvrez Paramètres, et téléchargez-le depuis la carte « Export ' +
          'intégral ». Aucun lien n’est joint à ce message, et il n’y en aura pas : ' +
          'le fichier contient toute la base et ne quitte le serveur que dans une ' +
          'session authentifiée.',
        category: NotificationCategory.SYSTEME,
        audience: NotificationAudience.USERS,
        audienceUserIds: [actor.id],
      });
      return { noticeStatus: created.transportStatus ?? 'SENT', noticeDetail: null };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Export de la base : avis de fin non envoyé. ${detail}`);
      return { noticeStatus: 'FAILED', noticeDetail: detail };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Interne
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Ramène l'état enregistré à ce que l'horloge et le disque disent vraiment.
   *
   * C'est le seul endroit qui DÉTRUIT sur échéance et qui enterre un travail
   * mort avec le conteneur. Toutes les entrées du service passent par lui.
   */
  private async reconcile(now: Date): Promise<DumpJob | null> {
    const job = await this.read();
    if (job === null) return null;

    const status = effectiveStatus(job, now);
    if (status === job.status) return job;

    if (status === 'expired') {
      await this.removeFile(job.fileName);
      const next: DumpJob = { ...job, status: 'expired', fileName: null };
      await this.write(next, null);
      return next;
    }

    // `running` trop vieux : le processus est mort sans écrire son échec.
    const next: DumpJob = {
      ...job,
      status,
      finishedAt: now.toISOString(),
      failureReason: STALLED_REASON,
    };
    await this.write(next, null);
    return next;
  }

  /** Le fichier a été livré : il n'a plus de raison d'exister. */
  private async consume(job: DumpJob, actorId: string): Promise<void> {
    await this.removeFile(job.fileName);
    await this.write(
      { ...job, status: 'expired', fileName: null, downloadedAt: new Date().toISOString() },
      actorId,
    );
    this.logger.log(`Export de la base téléchargé puis détruit (${job.id}).`);
  }

  private async removeFile(fileName: string | null): Promise<void> {
    if (fileName === null) return;
    await rm(join(this.directory, basename(fileName)), { force: true });
  }

  /**
   * Efface tout ce qui traîne dans le répertoire, hormis `keep`.
   *
   * Un redéploiement au milieu d'un export laisse un `.sql.gz` que plus aucune
   * ligne d'état ne désigne. Personne ne le sert, personne ne le détruit, et
   * il contient la base entière.
   */
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
    // Une seconde lecture du fichier, assumée : la compression est faite par un
    // flux que le lanceur possède, et y greffer un condensat obligerait chaque
    // implémentation de `DumpRunner`, doublures de test comprises, à le
    // calculer correctement. L'empreinte sert à vérifier un téléchargement, pas
    // à aller vite.
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
    return hash.digest('hex');
  }

  private async read(): Promise<DumpJob | null> {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    if (!setting) return null;
    try {
      const value: unknown = JSON.parse(setting.value);
      if (!value || typeof value !== 'object') return null;
      const record = value as Partial<DumpJob>;
      if (typeof record.id !== 'string' || typeof record.status !== 'string') return null;
      return record as DumpJob;
    } catch {
      return null;
    }
  }

  private async write(job: DumpJob, actorId: string | null): Promise<void> {
    const value = JSON.stringify(job);
    await this.prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value, updatedById: actorId },
      update: { value, updatedById: actorId },
    });
  }

  /**
   * Trace, dans le MÊME journal que la purge de la base.
   *
   * `entity: 'database'` et `action` explicites : ce sont les deux seules
   * opérations qui portent sur la base dans son ensemble, et elles doivent se
   * retrouver côte à côte quand quelqu'un demande « qui a touché aux données ».
   */
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
