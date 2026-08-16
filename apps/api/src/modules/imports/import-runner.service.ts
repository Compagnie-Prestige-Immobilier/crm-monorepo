import { Inject, Injectable, Logger } from '@nestjs/common';
import { ImportStatus, type ImportJob, type Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  IMPORT_ADAPTERS,
  type ImportAdapter,
  type ImportRowError,
  type ImportRunContext,
} from './import-adapter.js';
import { ImportClaim } from './import-claim.js';
import { readImportsEnv } from './imports.env.js';
import {
  boundErrors,
  exceedsCeiling,
  isClaimable,
  MAX_REPORTED_ERRORS,
  resumeSkip,
} from './imports.job.js';
import {
  IMPORT_ROW_READER,
  isBlankRow,
  UnreadableWorkbookError,
  type ImportRowReader,
  type SheetSource,
} from './xlsx-rows.js';

/**
 * LE MOTEUR. Il exécute un travail d'import, quelle que soit l'entité.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LES QUATRE PROPRIÉTÉS QU'IL TIENT, ET RIEN D'AUTRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. IL NE MATÉRIALISE JAMAIS LE CLASSEUR. Les lignes sont tirées une par une
 *    et relâchées dès la tranche écrite. La mémoire occupée ne dépend pas du
 *    nombre de lignes du fichier ;
 * 2. UNE TRANSACTION PAR TRANCHE, jamais une transaction géante. Cinquante
 *    mille lignes en une transaction tiennent un verrou pendant des minutes et
 *    perdent tout sur la dernière ligne ;
 * 3. `processedRows` AVANCE DANS LA MÊME TRANSACTION que les lignes qu'il
 *    compte. C'est ce qui rend la reprise exacte : jamais de lignes écrites non
 *    comptées, jamais de lignes comptées non écrites ;
 * 4. TOUTE ÉCRITURE PORTE LE JETON DE FENCING. Un travailleur qui a perdu son
 *    bail écrit sur zéro ligne, et la transaction de sa tranche est annulée :
 *    il n'aura rien créé du tout.
 */

/** Ce qu'un passage du moteur a donné, pour le journal et pour les tests. */
export type ImportRunOutcome =
  /** Le travail n'existe pas, ou n'est plus en vol. */
  | { readonly result: 'skipped'; readonly reason: string }
  /** Un autre travailleur le tient : c'est le cas NORMAL de la concurrence. */
  | { readonly result: 'busy' }
  /** Le bail a été perdu en cours de route. Rien n'a été écrit depuis. */
  | { readonly result: 'lost' }
  | { readonly result: 'succeeded'; readonly created: number; readonly processed: number }
  | { readonly result: 'failed'; readonly code: string };

/**
 * Délais de la transaction d'une tranche.
 *
 * Prisma applique 5 s / 2 s par défaut, ce qu'une tranche de cinq cents lignes
 * peut dépasser sur une base chargée. Les autres chemins de masse du dépôt
 * (tirage de campagne, purge administrative) relèvent déjà ces bornes.
 */
const CHUNK_TRANSACTION_TIMEOUT_MS = 60_000;
const CHUNK_TRANSACTION_MAX_WAIT_MS = 15_000;

/** Le bail a changé de main pendant la tranche. Annule la transaction. */
class LostLeaseError extends Error {
  constructor() {
    super('Le bail a été repris par un autre travailleur.');
    this.name = 'LostLeaseError';
  }
}

/** Le refus qui arrête la course, avec le code que le rapport portera. */
class ImportRunFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ImportRunFailure';
  }
}

type AnyImportAdapter = ImportAdapter<unknown>;

interface Totals {
  processed: number;
  created: number;
  skipped: number;
  errorRows: number;
  errors: ImportRowError[];
}

@Injectable()
export class ImportRunnerService {
  private readonly logger = new Logger(ImportRunnerService.name);
  private readonly config = readImportsEnv();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IMPORT_ADAPTERS) private readonly adapters: readonly AnyImportAdapter[],
    @Inject(IMPORT_ROW_READER) private readonly reader: ImportRowReader,
  ) {}

  /**
   * Exécute UN travail, s'il est prenable.
   *
   * La prise est faite ICI et pas chez l'appelant : c'est la leçon de
   * `dispatch-claim.ts`. Un second appelant écrit demain (une route « relancer »,
   * un script d'exploitation) hérite de la prise sans avoir à y penser, parce
   * qu'il n'existe aucune autre porte.
   */
  async run(jobId: string, now = new Date()): Promise<ImportRunOutcome> {
    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (job === null) return { result: 'skipped', reason: 'IMPORT_JOB_ABSENT' };
    if (!isClaimable(job, now)) return { result: 'busy' };

    const claim = await ImportClaim.take(this.prisma, jobId, now);
    if (claim === null) return { result: 'busy' };

    const adapter = this.adapters.find((candidate) => candidate.kind === job.kind);
    if (adapter === undefined) {
      return this.fail(
        claim,
        'IMPORT_ADAPTER_MISSING',
        `Aucun adaptateur n’est enregistré pour « ${job.kind} ».`,
      );
    }

    let source: SheetSource | null = null;
    try {
      source = await this.openSource(job, adapter);
      return await this.consume(job, adapter, claim, source);
    } catch (error) {
      if (error instanceof LostLeaseError) return { result: 'lost' };
      if (error instanceof ImportRunFailure) {
        return await this.fail(claim, error.code, error.message);
      }
      if (error instanceof UnreadableWorkbookError) {
        return await this.fail(claim, 'IMPORT_FILE_UNREADABLE', error.reason);
      }
      this.logger.error(`Import ${jobId} : échec inattendu. ${String(error)}`);
      return await this.fail(claim, 'IMPORT_FAILED', String(error));
    } finally {
      // La source est fermée QUOI QU'IL ARRIVE, refus au plafond compris : un
      // descripteur laissé ouvert par import refusé finit par épuiser le
      // conteneur, et le symptôme n'a alors plus rien à voir avec l'import.
      await source?.close();
    }
  }

  /**
   * Ouvre le classeur et REFUSE AU PLUS TÔT.
   *
   * Le plafond est éprouvé sur le nombre de lignes ANNONCÉ PAR L'EN-TÊTE de la
   * feuille, avant qu'une seule cellule n'ait été lue : un classeur de deux
   * millions de lignes est écarté pour le prix de l'ouverture du fichier. Ce
   * contrôle-là n'est pas suffisant (l'en-tête est facultatif dans le format,
   * voir `SheetSource.declaredDataRows`), il est simplement gratuit ; le
   * compteur de lecture reprend le relais dans `consume`.
   */
  private async openSource(job: ImportJob, adapter: AnyImportAdapter): Promise<SheetSource> {
    const source = await this.reader.open(job.storagePath, adapter.templateColumns);

    if (exceedsCeiling(source.declaredDataRows, adapter.maxRows)) {
      // FERMÉE ICI, avant de lever : `run` ne connaît pas encore cette source
      // (l'affectation n'a pas eu lieu), donc son `finally` ne la fermerait
      // pas. Un refus au plafond laisserait alors un descripteur ouvert par
      // classeur refusé — et le symptôme, plus tard, n'aurait plus rien à voir
      // avec l'import.
      await source.close();
      throw new ImportRunFailure(
        'IMPORT_TOO_MANY_ROWS',
        `Le fichier dépasse le plafond de ${String(adapter.maxRows)} lignes. Découpez-le.`,
      );
    }

    return source;
  }

  /** Lit, analyse, écrit par tranches, puis clôt. */
  private async consume(
    job: ImportJob,
    adapter: AnyImportAdapter,
    claim: ImportClaim,
    source: SheetSource,
  ): Promise<ImportRunOutcome> {
    const chunkSize = this.config.IMPORTS_CHUNK_SIZE;
    const skip = resumeSkip(job.processedRows);

    // Les compteurs REPARTENT de ce que la base porte, jamais de zéro : une
    // reprise qui remettrait les compteurs à plat annoncerait moins de fiches
    // créées qu'il n'y en a réellement, sur un écran dont c'est le seul chiffre.
    const totals: Totals = {
      processed: skip,
      created: job.createdRows,
      skipped: job.skippedRows,
      errorRows: job.errorRows,
      errors: reportedErrors(job.report),
    };

    const started = new Date();
    if (
      !(await claim.write(
        {
          status: ImportStatus.running,
          startedAt: job.startedAt ?? started,
          totalRows: source.declaredDataRows,
        },
        started,
      ))
    ) {
      throw new LostLeaseError();
    }

    await adapter.prepare(this.contextOn(job, this.prisma));

    let seen = 0;
    let pendingConsumed = 0;
    let buffer: unknown[] = [];

    const flush = async (): Promise<void> => {
      if (pendingConsumed === 0) return;
      await this.writeChunk(job, adapter, claim, buffer, pendingConsumed, totals);
      buffer = [];
      pendingConsumed = 0;
    };

    for await (const raw of source.rows()) {
      if (isBlankRow(raw.cells)) continue;

      seen += 1;

      // LE SECOND CONTRÔLE DU PLAFOND, celui qui est une borne et non une
      // politesse. Il tombe à la 50 001e ligne, pas à la dernière : le refus
      // arrive donc AVANT que le reste du classeur n'ait été lu.
      if (exceedsCeiling(seen, adapter.maxRows)) {
        throw new ImportRunFailure(
          'IMPORT_TOO_MANY_ROWS',
          `Le fichier dépasse le plafond de ${String(adapter.maxRows)} lignes. Découpez-le.`,
        );
      }

      // REPRISE : les lignes déjà comptées sont sautées sans être analysées ni
      // écrites. Voir `resumeSkip` pour l'invariant qui rend ce saut exact.
      if (seen <= skip) continue;

      const parsed = adapter.parseRow(raw.cells, raw.rowNumber);
      if (parsed.ok) {
        buffer.push(parsed.row);
      } else {
        totals.errorRows += 1;
        totals.errors = boundErrors(totals.errors, [parsed.error]);
      }

      pendingConsumed += 1;
      // La tranche se compte en lignes CONSOMMÉES, pas en lignes valides : c'est
      // `processedRows` qui décide de la reprise, et il compte tout ce qui a été
      // lu. Une tranche comptée en lignes valides ferait rejouer les lignes
      // fausses à chaque reprise, indéfiniment.
      if (pendingConsumed >= chunkSize) await flush();
    }

    await flush();

    const finished = new Date();
    const report = buildReport(job, totals, seen);
    if (
      !(await claim.write(
        {
          status: ImportStatus.succeeded,
          processedRows: totals.processed,
          createdRows: totals.created,
          skippedRows: totals.skipped,
          errorRows: totals.errorRows,
          totalRows: seen,
          report,
          finishedAt: finished,
        },
        finished,
      ))
    ) {
      throw new LostLeaseError();
    }

    return { result: 'succeeded', created: totals.created, processed: totals.processed };
  }

  /**
   * UNE tranche, UNE transaction, et le compteur DEDANS.
   *
   * L'ordre est la propriété : l'adaptateur écrit, puis le compteur avance sous
   * bail. Si le bail a changé de main, l'écriture du compteur touche zéro ligne,
   * on lève, et PostgreSQL annule la transaction entière — les lignes de
   * l'adaptateur avec. Un travailleur qui a perdu son bail n'a donc rien créé,
   * pas même la tranche qu'il était en train d'écrire.
   */
  private async writeChunk(
    job: ImportJob,
    adapter: AnyImportAdapter,
    claim: ImportClaim,
    rows: readonly unknown[],
    consumed: number,
    totals: Totals,
  ): Promise<void> {
    const processed = totals.processed + consumed;

    const outcome = await this.prisma.$transaction(
      async (tx) => {
        const chunk = await adapter.writeChunk(rows, this.contextOn(job, tx));

        const written = await claim.writeIn(
          tx,
          {
            status: ImportStatus.running,
            processedRows: processed,
            createdRows: totals.created + chunk.created,
            skippedRows: totals.skipped + chunk.skipped,
            errorRows: totals.errorRows + chunk.errors.length,
          },
          new Date(),
        );
        if (!written) throw new LostLeaseError();

        return chunk;
      },
      { timeout: CHUNK_TRANSACTION_TIMEOUT_MS, maxWait: CHUNK_TRANSACTION_MAX_WAIT_MS },
    );

    // Les totaux en mémoire ne bougent qu'APRÈS la validation de la
    // transaction : une tranche annulée ne doit pas laisser de trace dans les
    // chiffres qu'un passage ultérieur écrirait.
    totals.processed = processed;
    totals.created += outcome.created;
    totals.skipped += outcome.skipped;
    totals.errorRows += outcome.errors.length;
    totals.errors = boundErrors(totals.errors, outcome.errors);
  }

  private contextOn(job: ImportJob, tx: Prisma.TransactionClient): ImportRunContext {
    return {
      jobId: job.id,
      mode: job.mode,
      requestedById: job.requestedById,
      tx,
    };
  }

  /**
   * Écrit l'échec, SOUS BAIL.
   *
   * Un échec écrit sans le jeton effacerait le travail d'un autre travailleur
   * qui aurait légitimement repris la ligne : le mort déclarerait en échec un
   * import bien vivant.
   */
  private async fail(claim: ImportClaim, code: string, message: string): Promise<ImportRunOutcome> {
    const now = new Date();
    await claim.write(
      {
        status: ImportStatus.failed,
        failureCode: code,
        failureMsg: message.slice(0, 2_000),
        finishedAt: now,
      },
      now,
    );
    return { result: 'failed', code };
  }
}

/** Les erreurs déjà rapportées, relues d'un rapport partiel. */
function reportedErrors(report: Prisma.JsonValue | null): ImportRowError[] {
  if (report === null || typeof report !== 'object' || Array.isArray(report)) return [];
  const errors = (report as Record<string, unknown>).errors;
  if (!Array.isArray(errors)) return [];

  // Relecture DÉFENSIVE : le rapport est du `Json`, donc rien ne garantit sa
  // forme, et une reprise ne doit pas mourir sur un rapport écrit par une
  // version antérieure.
  return errors.flatMap((entry): ImportRowError[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.code !== 'string' || typeof row.message !== 'string') return [];
    return [
      {
        rowNumber: typeof row.rowNumber === 'number' ? row.rowNumber : 0,
        ...(typeof row.column === 'string' ? { column: row.column } : {}),
        code: row.code,
        message: row.message,
      },
    ];
  });
}

/**
 * Le rapport, DANS LA FORME QUE L'ÉCRAN SAIT DÉJÀ LIRE.
 *
 * `truncated` est explicite plutôt que déduit d'une longueur : « il y avait
 * plus d'erreurs que celles-ci » doit se lire, pas se deviner en comparant deux
 * nombres. `errorRows` reste EXACT même quand la liste est tronquée.
 */
function buildReport(job: ImportJob, totals: Totals, totalRows: number): Prisma.InputJsonValue {
  return {
    mode: job.mode,
    kind: job.kind,
    totalRows,
    processedRows: totals.processed,
    createdRows: totals.created,
    skippedRows: totals.skipped,
    errorRows: totals.errorRows,
    truncated: totals.errorRows > totals.errors.length,
    maxReportedErrors: MAX_REPORTED_ERRORS,
    errors: totals.errors.map((error) => ({
      rowNumber: error.rowNumber,
      ...(error.column === undefined ? {} : { column: error.column }),
      code: error.code,
      message: error.message,
    })),
  };
}
