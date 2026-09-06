import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ImportKind, ImportMode, ImportStatus, Prisma, type ImportJob } from '@crm/database';
import type { MultipartFile } from '@fastify/multipart';
import type { FastifyRequest } from 'fastify';
import { v7 as uuidv7 } from 'uuid';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LiveService } from '../live/live.service.js';
import {
  IMPORT_FILE_STORE,
  ImportFileTooLargeError,
  type ImportFileStore,
} from './import-file.store.js';
import { ImportRunnerService } from './import-runner.service.js';
import { readImportsEnv } from './imports.env.js';
import type {
  ImportJobDto,
  ImportJobListDto,
  ImportJobQueryDto,
  ImportJobReportDto,
} from './dto.js';

/**
 * La face visible des imports : déposer, suivre, appliquer.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA ROUTE NE TRAVAILLE PAS, ELLE INSCRIT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'import synchrone lisait le classeur, contrôlait les référentiels, comptait
 * les doublons et écrivait, TOUT PENDANT LA REQUÊTE HTTP. À cinq mille lignes
 * cela tenait déjà mal ; à cinquante mille, le relais Next et le navigateur
 * coupent bien avant la fin, et l'administrateur ne sait pas si son import a
 * eu lieu. Pire : il recommence.
 *
 * Ici, la route écrit le fichier sur le volume, inscrit un travail `queued` et
 * rend la main. Le travail court en arrière-plan, et l'écran sonde `GET
 * /imports/{id}`, dont `processedRows` sur `totalRows` donne l'avancement sans
 * qu'aucun mécanisme de progression n'ait été inventé pour cela.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UN IMPORT NAÎT TOUJOURS EN SIMULATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `DRY_RUN` n'est pas un défaut de paramètre, c'est le seul état de naissance
 * possible : il n'existe aucune façon de déposer un fichier en mode APPLY. Un
 * classeur de plusieurs milliers de lignes rempli à la main contient toujours
 * des numéros malformés, des départements mal orthographiés et des doublons
 * internes. Les appliquer sans les avoir vus produit des fiches dont personne
 * ne sait lesquelles sont bonnes, et la suppression logique ne les fait pas
 * disparaître de l'index d'unicité du téléphone.
 */
@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);
  private readonly config = readImportsEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: ImportRunnerService,
    @Inject(IMPORT_FILE_STORE) private readonly files: ImportFileStore,
    private readonly live: LiveService,
  ) {}

  /**
   * Dépose un classeur et inscrit le travail. NE BLOQUE PAS.
   *
   * Le flux est écrit DIRECTEMENT sur le volume, sans jamais passer par un
   * tampon en mémoire : `toBuffer()` matérialiserait le fichier entier avant le
   * moindre contrôle, ce qui ferait du téléversement un moyen d'épuiser le
   * conteneur plutôt qu'un import.
   */
  async create(
    user: AuthenticatedUser,
    request: FastifyRequest,
    kind: ImportKind,
    now = new Date(),
  ): Promise<ImportJobDto> {
    const maxBytes = this.config.IMPORTS_MAX_BYTES;

    let upload: MultipartFile | undefined;
    try {
      // Le plafond est PASSÉ au parseur et non vérifié après coup :
      // `@fastify/multipart` est enregistré globalement avec le plafond de l'APK
      // Android, plusieurs centaines de mégaoctets. Sans cette borne propre à la
      // route, un envoi de 500 Mo serait accepté avant d'être refusé.
      upload = await request.file({ limits: { fileSize: maxBytes, files: 1 } });
    } catch {
      throw this.tooLarge(maxBytes);
    }

    if (!upload) {
      throw new BadRequestException({
        code: 'IMPORT_FILE_MISSING',
        message: 'Aucun fichier reçu. Envoyez le classeur dans un champ `file`.',
      });
    }

    const jobId = uuidv7();
    let stored;
    try {
      stored = await this.files.save(jobId, upload.file, maxBytes);
    } catch (error) {
      if (error instanceof ImportFileTooLargeError) throw this.tooLarge(maxBytes);
      throw error;
    }

    if (upload.file.truncated) {
      await this.files.remove(stored.storagePath);
      throw this.tooLarge(maxBytes);
    }

    try {
      const job = await this.prisma.importJob.create({
        data: {
          id: jobId,
          kind,
          status: ImportStatus.queued,
          mode: ImportMode.DRY_RUN,
          requestedById: user.id,
          // Le nom d'origine est conservé POUR ÊTRE AFFICHÉ, jamais pour être
          // joint à un chemin : le fichier sur le disque est nommé d'après
          // l'identifiant du travail. Voir `import-file.store.ts`.
          fileName: (upload.filename || 'import.xlsx').slice(0, 255),
          fileBytes: stored.bytes,
          storagePath: stored.storagePath,
          expiresAt: new Date(now.getTime() + this.config.IMPORTS_TTL_HOURS * 3_600_000),
        },
      });
      this.live.emit('imports');

      // Non attendu, EXPRÈS : la route rend 201 immédiatement. `void` et un
      // `catch`, parce qu'une promesse rejetée sans gestionnaire ferait tomber
      // le processus Node entier. Le balayage périodique reprendrait de toute
      // façon le travail, ce départ immédiat n'est qu'une politesse.
      void this.runner.run(job.id).catch((error: unknown) => {
        this.logger.error(`Import ${job.id} : départ immédiat impossible. ${String(error)}`);
      });

      return toDto(job);
    } catch (error) {
      // Le fichier ne survit pas à un travail qui n'a pas pu être inscrit :
      // personne ne le nommerait plus, et le balayage ne connaît que les
      // fichiers dont une ligne porte le chemin.
      await this.files.remove(stored.storagePath);
      throw error;
    }
  }

  async get(id: string): Promise<ImportJobDto> {
    const job = await this.prisma.importJob.findUnique({ where: { id } });
    if (job === null) {
      throw new NotFoundException({
        code: 'IMPORT_JOB_NOT_FOUND',
        message: 'Ce travail d’import n’existe pas.',
      });
    }
    return toDto(job);
  }

  async list(query: ImportJobQueryDto): Promise<ImportJobListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.ImportJobWhereInput = {
      ...(query.kind === undefined ? {} : { kind: query.kind }),
      ...(query.status === undefined ? {} : { status: query.status }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.importJob.count({ where }),
      this.prisma.importJob.findMany({
        where,
        // `id` en second critère : sans lui, deux lignes de même date peuvent
        // s'échanger entre deux pages et l'une disparaît de la pagination.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toDto),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  /**
   * Applique un import déjà SIMULÉ.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * LA MÊME LIGNE EST REMISE EN FILE, ET CE N'EST PAS UN RACCOURCI
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Créer un SECOND travail pointant sur le même fichier ferait cohabiter deux
   * lignes avec un seul classeur : la première à expirer détruirait le fichier
   * sous la seconde, qui échouerait en annonçant un fichier illisible. Un
   * fichier, un travail.
   *
   * La transition est un `updateMany` CONDITIONNEL, jamais une lecture suivie
   * d'une écriture : deux clics simultanés sur « Appliquer » ne produisent
   * qu'une seule remise en file, c'est PostgreSQL qui arbitre.
   *
   * Les compteurs et le rapport de la simulation sont REMIS À ZÉRO. Le rapport
   * de l'application les remplace, dans la même forme : garder les deux
   * exigerait une seconde colonne, et laisser les anciens compteurs afficherait
   * une progression qui commence à 100 %.
   *
   * Sur un travail APPLY déjà ÉCHOUÉ, la même route reprend le fichier là où il
   * s'est arrêté : voir `resumeFailedApply`.
   */
  async apply(id: string, now = new Date()): Promise<ImportJobDto> {
    const requeued = await this.prisma.importJob.updateMany({
      where: {
        id,
        status: ImportStatus.succeeded,
        mode: ImportMode.DRY_RUN,
        expiresAt: { gt: now },
      },
      data: {
        mode: ImportMode.APPLY,
        status: ImportStatus.queued,
        claimToken: null,
        claimedAt: null,
        startedAt: null,
        finishedAt: null,
        totalRows: null,
        processedRows: 0,
        createdRows: 0,
        updatedRows: 0,
        skippedRows: 0,
        errorRows: 0,
        report: Prisma.DbNull,
        failureCode: null,
        failureMsg: null,
      },
    });

    if (requeued.count !== 1 && (await this.resumeFailedApply(id, now)) === 1) {
      void this.runner.run(id).catch((error: unknown) => {
        this.logger.error(`Import ${id} : reprise immédiate impossible. ${String(error)}`);
      });
      return this.get(id);
    }

    if (requeued.count !== 1) {
      // La lecture n'a lieu QU'APRÈS l'échec de la transition : elle ne sert
      // qu'à dire POURQUOI, et n'entre jamais dans la décision.
      const job = await this.prisma.importJob.findUnique({ where: { id } });
      if (job === null) {
        throw new NotFoundException({
          code: 'IMPORT_JOB_NOT_FOUND',
          message: 'Ce travail d’import n’existe pas.',
        });
      }
      throw new ConflictException({
        code: 'IMPORT_NOT_APPLICABLE',
        message:
          'Seule une simulation TERMINÉE et non échue peut être appliquée. Ce travail est ' +
          `« ${job.status} » en mode « ${job.mode} », et son échéance est le ` +
          `${job.expiresAt.toISOString()}.`,
      });
    }

    void this.runner.run(id).catch((error: unknown) => {
      this.logger.error(`Import ${id} : départ immédiat impossible. ${String(error)}`);
    });

    return this.get(id);
  }

  /**
   * Repart d'une application interrompue, SANS REJOUER CE QUI EST DÉJÀ ÉCRIT.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * UN ÉCHEC À MI-FICHIER LAISSE DES FICHES, PAS UN TRAVAIL PROPRE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Chaque tranche est écrite dans SA transaction, et `processedRows` y est
   * inscrit avec elle : le compteur ne peut donc ni devancer ni retarder les
   * fiches créées. Mais un travail `failed` n'était repris par personne — ni le
   * balayage, qui ne connaît que `queued`/`running`, ni « Appliquer », qui
   * n'accepte qu'une simulation. Trente mille fiches sur cinquante mille
   * restaient en base sans aucun chemin pour finir, et redéposer le fichier
   * butait sur ces trente mille doublons.
   *
   * Les compteurs sont donc CONSERVÉS — c'est eux qui portent la position de
   * reprise — et seul l'échec est effacé. Le moteur reprend à `processedRows`.
   *
   * Réservé au mode APPLY : une simulation échouée n'a rien écrit, la redéposer
   * ne coûte rien et évite de reprendre un rapport partiel.
   */
  private async resumeFailedApply(id: string, now: Date): Promise<number> {
    const resumed = await this.prisma.importJob.updateMany({
      where: {
        id,
        status: ImportStatus.failed,
        mode: ImportMode.APPLY,
        expiresAt: { gt: now },
      },
      data: {
        status: ImportStatus.queued,
        claimToken: null,
        claimedAt: null,
        finishedAt: null,
        failureCode: null,
        failureMsg: null,
      },
    });
    return resumed.count;
  }

  /**
   * Détruit les fichiers échus et clôt leur travail.
   *
   * `claimToken` est REMIS À NUL en même temps, et c'est ce qui rend l'échéance
   * sûre pendant qu'un travailleur court : ses écritures suivantes portent un
   * jeton que plus aucune ligne ne détient, elles touchent zéro ligne, et il
   * s'arrête de lui-même. Sans cela, l'expiration détruirait le fichier sous un
   * travailleur qui continuerait à écrire des fiches sans jamais pouvoir se
   * clore.
   */
  async expireDue(now = new Date()): Promise<number> {
    const due = await this.prisma.importJob.findMany({
      where: { expiresAt: { lte: now }, status: { not: ImportStatus.expired } },
      select: { id: true, storagePath: true },
      take: 100,
    });

    let closed = 0;
    for (const job of due) {
      // LA LIGNE D'ABORD, LE FICHIER ENSUITE. Une coupure entre les deux laisse
      // au pire un fichier orphelin ; dans l'autre ordre elle laisse un travail
      // qui se dit vivant sans classeur, et le balayage suivant diagnostique un
      // « fichier illisible » là où la cause est l'échéance.
      const updated = await this.prisma.importJob.updateMany({
        where: { id: job.id, status: { not: ImportStatus.expired } },
        data: {
          status: ImportStatus.expired,
          claimToken: null,
          report: Prisma.DbNull,
          finishedAt: now,
        },
      });
      closed += updated.count;
      await this.files.remove(job.storagePath);
    }

    return closed;
  }

  private tooLarge(maxBytes: number): PayloadTooLargeException {
    return new PayloadTooLargeException({
      code: 'IMPORT_FILE_TOO_LARGE',
      message: `Le fichier dépasse ${String(Math.round(maxBytes / 1_048_576))} Mo.`,
      maxBytes,
    });
  }
}

/** Le rapport, relu DÉFENSIVEMENT : c'est du `Json`, rien n'en garantit la forme. */
function toReportDto(value: Prisma.JsonValue | null): ImportJobReportDto | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const report = value as Record<string, unknown>;

  const errors = Array.isArray(report.errors) ? report.errors : [];

  return {
    kind: report.kind as ImportKind,
    mode: report.mode as ImportMode,
    totalRows: numberOr(report.totalRows, 0),
    processedRows: numberOr(report.processedRows, 0),
    createdRows: numberOr(report.createdRows, 0),
    updatedRows: numberOr(report.updatedRows, 0),
    skippedRows: numberOr(report.skippedRows, 0),
    errorRows: numberOr(report.errorRows, 0),
    truncated: report.truncated === true,
    maxReportedErrors: numberOr(report.maxReportedErrors, errors.length),
    errors: errors.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) return [];
      const row = entry as Record<string, unknown>;
      return [
        {
          rowNumber: numberOr(row.rowNumber, 0),
          column: typeof row.column === 'string' ? row.column : null,
          code: typeof row.code === 'string' ? row.code : 'UNKNOWN',
          message: typeof row.message === 'string' ? row.message : '',
        },
      ];
    }),
  };
}

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export function toDto(job: ImportJob): ImportJobDto {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    mode: job.mode,
    requestedById: job.requestedById,
    fileName: job.fileName,
    fileBytes: job.fileBytes,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    createdRows: job.createdRows,
    updatedRows: job.updatedRows,
    skippedRows: job.skippedRows,
    errorRows: job.errorRows,
    report: toReportDto(job.report),
    failureCode: job.failureCode,
    failureMsg: job.failureMsg,
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    expiresAt: job.expiresAt.toISOString(),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}
