import { BadRequestException, Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import { RepresentantRelation, WhatsappStatus } from '@crm/database';
import type { RepCallOutcome } from '@crm/database';
import type { MultipartFile } from '@fastify/multipart';
import type { FastifyRequest } from 'fastify';
import ExcelJS from 'exceljs';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service.js';
import { tryNormalizePhone } from '../../common/phone.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { IMPORT_COLUMNS } from './import-template.js';
import { normalizeKey, parseComplements } from './import-fields.js';
import type {
  ImportQueryDto,
  ImportReportDto,
  ImportRowErrorDto,
  ImportRowPreviewDto,
} from './dto.js';

export { normalizeKey };

/** Import Excel avec simulation préalable et dédoublonnage du téléphone normalisé. */

/** Au-delà, utiliser un outil de reprise plutôt qu'un import. */
export const IMPORT_MAX_ROWS = 5_000;

/** Refuse les classeurs trop volumineux avant leur lecture. */
export const IMPORT_MAX_BYTES = 10 * 1_024 * 1_024;

/** Bornes de la transaction d'écriture massive. */
const IMPORT_TRANSACTION_TIMEOUT_MS = 60_000;
const IMPORT_TRANSACTION_MAX_WAIT_MS = 15_000;

/** Limite la liste d'erreurs renvoyée à l'utilisateur. */
const MAX_REPORTED_ERRORS = 200;

/** Cap preview rows returned to the user. */
const MAX_PREVIEW_ROWS = 50;

/**
 * Première ligne de données.
 *
 * Ligne 1 : l'en-tête. Ligne 2 : l'exemple grisé écrit par le générateur de
 * modèle. Ligne 3 : la première fiche réelle.
 *
 * L'exemple N'EST PAS LU, et c'est un correctif, pas un choix de confort. Il
 * valait 2, donc la ligne d'exemple était lue comme une fiche ordinaire, et
 * l'onglet Instructions autorisait explicitement à la laisser en place. Un
 * classeur rempli sans la supprimer créait donc en base un représentant
 * « Fatou Ndiaye » au 77 123 45 67, qui prenait le numéro d'exemple dans
 * l'index d'unicité et le rendait indisponible à toute vraie fiche.
 *
 * `representants-export.service.ts` écrit le modèle en respectant cette borne,
 * et l'onglet Instructions dit désormais la même chose. Le test
 * `l'exemple du modèle n'est jamais importé` tient les trois ensemble.
 */
export const FIRST_DATA_ROW = 3;

interface ParsedRow {
  readonly line: number;
  readonly fullName: string;
  readonly phoneE164: string;
  readonly departementId: string;
  readonly departementName: string;
  readonly iefId: string | null;
  readonly iefName: string | null;
  readonly notes: string | null;
  readonly etablissement: string | null;
  readonly relationStatus: RepresentantRelation;
  readonly whatsappStatus: WhatsappStatus;
  /** Le compte propriétaire de la fiche. `null` : celui qui importe. */
  readonly ownerId: string | null;
  /** L'appel déjà passé, quand le fichier le date. */
  readonly appel: {
    readonly date: Date;
    readonly outcome: RepCallOutcome;
    readonly comment: string | null;
  } | null;
}

@Injectable()
export class RepresentantsImportService {
  private readonly logger = new Logger(RepresentantsImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async import(
    user: AuthenticatedUser,
    request: FastifyRequest,
    query: ImportQueryDto,
  ): Promise<ImportReportDto> {
    const dryRun = query.dryRun ?? true;
    const enrichir = query.enrichir ?? false;
    const buffer = await this.readFile(request);
    // Le plafond de lignes est appliqué DANS la lecture, pas après : voir
    // `readSheet`. Un classeur de deux millions de lignes n'a plus l'occasion
    // d'être matérialisé avant d'être refusé.
    const rows = await this.readSheet(buffer);

    const referentiels = await this.loadReferentiels();
    const { parsed, errors, duplicatesInFile } = analyser(rows, referentiels);
    let duplicates = duplicatesInFile;

    // Le contrôle contre la base se fait en UNE requête, pas une par ligne : sur
    // 5 000 lignes, une lecture par ligne rendrait l'import inutilisable et
    // saturerait le pool de connexions.
    const known = await this.existingByPhone(parsed.map((row) => row.phoneE164));
    const retained: ParsedRow[] = [];
    const aEnrichir: Enrichissement[] = [];
    for (const row of parsed) {
      const existante = known.get(row.phoneE164);
      if (!existante) {
        retained.push(row);
        continue;
      }

      duplicates += 1;
      const patch = enrichir ? enrichissementDe(row, existante, user.id) : null;
      if (patch) aEnrichir.push(patch);
      else errors.push(refusDoublon(row, enrichir));
    }

    let enriched = 0;
    if (!dryRun && aEnrichir.length > 0) {
      enriched = await this.applyEnrichissement(aEnrichir);
      this.logger.log(
        `Enrichissement représentants par ${user.username} : ${String(enriched)} fiches complétées.`,
      );
    }

    let created = 0;
    if (!dryRun && retained.length > 0) {
      created = await this.apply(user, retained);

      // L'ÉCART EST DIT, IL N'EST PAS AVALÉ.
      //
      // `skipDuplicates` peut écarter une ligne que nos contrôles avaient
      // retenue : entre la lecture des téléphones connus et l'écriture, un
      // commercial a pu saisir la même fiche sur le terrain. La ligne disparaît
      // alors sans un mot, alors que l'en-tête de ce module promet « tout ou
      // rien » et que le rapport annonce `valid` lignes retenues. L'utilisateur
      // lisait « 40 valides, 40 créés » pour 38 fiches réellement en base.
      //
      // On ne fait pas échouer l'import pour autant : les 38 sont écrites et
      // légitimes, et les annuler obligerait à tout recommencer pour deux
      // doublons. On rapporte, et le rapport reste vrai.
      if (created < retained.length) {
        const perdues = retained.length - created;
        errors.push({
          line: 0,
          code: 'SKIPPED_ON_WRITE',
          message: `${String(perdues)} ligne(s) retenue(s) n’ont pas été écrites : leur numéro a été pris par une autre saisie pendant l’import. Relancez une simulation pour les identifier.`,
          value: null,
        });
      }

      this.logger.log(
        `Import représentants par ${user.username} : ${String(created)} créés sur ${String(retained.length)} retenus, ${String(errors.length)} lignes rejetées.`,
      );
    }

    return {
      dryRun,
      totalRows: rows.length,
      valid: retained.length,
      rejected: errors.length,
      duplicates,
      created,
      // En simulation, le nombre de fiches qui SERAIENT complétées : c'est la
      // question à laquelle l'écran doit répondre avant d'écrire.
      enrichable: aEnrichir.length,
      enriched,
      errors: errors.slice(0, MAX_REPORTED_ERRORS),
      preview: retained.slice(0, MAX_PREVIEW_ROWS).map((row): ImportRowPreviewDto => ({
        line: row.line,
        fullName: row.fullName,
        phoneE164: row.phoneE164,
        departementName: row.departementName,
        iefName: row.iefName,
        notes: row.notes,
        etablissement: row.etablissement,
        relationStatus: row.relationStatus,
        whatsappStatus: row.whatsappStatus,
        calledAt: row.appel?.date.toISOString() ?? null,
      })),
    };
  }

  /**
   * Écrit les lignes retenues, EN UNE SEULE TRANSACTION.
   *
   * Un import à moitié appliqué est la pire issue : l'utilisateur ne sait pas
   * où il s'est arrêté, et rejouer le fichier bute sur les doublons de ce qui
   * est déjà passé. Tout ou rien.
   *
   * `createMany` plutôt qu'une boucle de `create` : 5 000 allers et retours
   * dépasseraient le délai de la transaction bien avant la fin.
   *
   * LES DÉLAIS SONT RELEVÉS EXPLICITEMENT. Sans options, Prisma applique 5 s de
   * `timeout` et 2 s de `maxWait` : une insertion de 5 000 lignes les dépasse
   * sur une base chargée, et l'utilisateur reçoit une erreur de transaction
   * après avoir attendu la lecture complète de son classeur. Tous les autres
   * chemins de masse du dépôt (tirage de campagne, purge) relèvent déjà ces
   * bornes ; celui-ci était le seul à ne pas le faire.
   */
  private async apply(user: AuthenticatedUser, rows: readonly ParsedRow[]): Promise<number> {
    const now = new Date();
    // UUID v7 engendrés ICI et non dans le `map` d'écriture : les appels déjà
    // passés s'y rattachent par clé étrangère, et il faut donc les connaître
    // avant d'écrire. L'import n'a pas de client hors ligne, mais l'identifiant
    // doit rester du même format que ceux du mobile, sinon l'ordre
    // lexicographique cesse d'être l'ordre temporel.
    const avecId = rows.map((row) => ({ row, id: uuidv7() }));

    const result = await this.prisma.$transaction(
      async (tx) => {
        const ecrites = await tx.representant.createMany({
          data: avecId.map(({ row, id }) => ({
            id,
            fullName: row.fullName,
            phoneE164: row.phoneE164,
            departementId: row.departementId,
            iefId: row.iefId,
            notes: row.notes,
            etablissement: row.etablissement,
            relationStatus: row.relationStatus,
            whatsappStatus: row.whatsappStatus,
            createdById: row.ownerId ?? user.id,
            // La saisie terrain est inconnue pour un import : on retient l'instant
            // de l'import, et non une date inventée. Les statistiques d'activité
            // s'appuient dessus, une valeur fabriquée les fausserait.
            clientCreatedAt: now,
          })),
          // La contrainte d'unicité est doublée par l'index partiel : une ligne
          // qui s'y heurterait malgré nos contrôles est ignorée plutôt que de
          // faire échouer les 4 999 autres. L'écart est RAPPORTÉ, voir
          // `import()` : silencieux, il contredirait la promesse « tout ou rien ».
          skipDuplicates: true,
        });

        // Les appels ne se rattachent qu'aux fiches RÉELLEMENT écrites. Sans
        // cette relecture, une ligne écartée par `skipDuplicates` laisserait un
        // appel pointant sur un identifiant absent : la clé étrangère fait
        // alors échouer toute la tranche, y compris les fiches légitimes.
        const appels = avecId.flatMap(({ row, id }) =>
          row.appel === null ? [] : [{ id, appel: row.appel, performedById: row.ownerId ?? user.id }],
        );
        if (appels.length > 0) {
          const presentes = new Set(
            (
              await tx.representant.findMany({
                where: { id: { in: appels.map(({ id }) => id) } },
                select: { id: true },
              })
            ).map((found) => found.id),
          );
          await tx.repCallAttempt.createMany({
            data: appels
              .filter(({ id }) => presentes.has(id))
              .map(({ id, appel, performedById }) => ({
                id: uuidv7(),
                representantId: id,
                performedById,
                outcome: appel.outcome,
                comment: appel.comment,
                clientCreatedAt: appel.date,
              })),
          });
        }

        return ecrites;
      },
      { timeout: IMPORT_TRANSACTION_TIMEOUT_MS, maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS },
    );
    return result.count;
  }

  /**
   * Les fiches déjà en base, avec de quoi juger ce qui leur manque.
   *
   * Lue PAR TRANCHES et non ligne à ligne : sur 5 000 lignes, une requête par
   * ligne rendrait l'import inutilisable et saturerait le pool.
   */
  private async existingByPhone(phones: readonly string[]): Promise<Map<string, FicheExistante>> {
    const found = new Map<string, FicheExistante>();
    const CHUNK = 1_000;

    for (let start = 0; start < phones.length; start += CHUNK) {
      const slice = phones.slice(start, start + CHUNK);
      const rows = await this.prisma.representant.findMany({
        where: { phoneE164: { in: slice }, deletedAt: null },
        select: {
          id: true,
          phoneE164: true,
          etablissement: true,
          notes: true,
          relationStatus: true,
          whatsappStatus: true,
          _count: { select: { repCallAttempts: true } },
        },
      });
      for (const row of rows) found.set(row.phoneE164, row);
    }

    return found;
  }

  /**
   * Complète les fiches existantes, PAR TRANCHES et non en un bloc.
   *
   * L'enrichissement n'est pas « tout ou rien », et n'a pas à l'être : il ne
   * remplit que du vide, donc le rejouer ne change rien la seconde fois. Une
   * transaction unique de trois mille mises à jour tiendrait un verrou pendant
   * des minutes pour perdre le tout sur la dernière ligne.
   */
  private async applyEnrichissement(rows: readonly Enrichissement[]): Promise<number> {
    const CHUNK = 500;
    let total = 0;

    for (let start = 0; start < rows.length; start += CHUNK) {
      const slice = rows.slice(start, start + CHUNK);
      await this.prisma.$transaction(
        async (tx) => {
          for (const { id, champs } of slice) {
            if (Object.keys(champs).length > 0) await tx.representant.update({ where: { id }, data: champs });
          }
          const appels = slice.flatMap(({ id, appel }) => (appel ? [{ id, appel }] : []));
          if (appels.length > 0) {
            await tx.repCallAttempt.createMany({
              data: appels.map(({ id, appel }) => ({
                id: uuidv7(),
                representantId: id,
                performedById: appel.performedById,
                outcome: appel.outcome,
                comment: appel.comment,
                clientCreatedAt: appel.date,
              })),
            });
          }
        },
        { timeout: IMPORT_TRANSACTION_TIMEOUT_MS, maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS },
      );
      total += slice.length;
    }

    return total;
  }

  private async loadReferentiels(): Promise<Referentiels> {
    const [departements, iefs, users] = await Promise.all([
      this.prisma.departement.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.ief.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true, departementId: true },
      }),
      this.prisma.user.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, username: true, email: true, fullName: true },
      }),
    ]);

    return {
      // Identifiant, e-mail ET nom complet : le classeur terrain désigne les
      // chargés de compte par leur prénom d'usage, pas par leur identifiant.
      users: new Map(
        users.flatMap((row) => [
          [normalizeKey(row.username), row],
          [normalizeKey(row.email), row],
          [normalizeKey(row.fullName), row],
        ]),
      ),
      // Indexés sur la forme NORMALISÉE (sans accent, sans casse) : un fichier
      // rempli à la main écrit « SAINT-LOUIS », « Saint Louis » et « saint
      // louis » pour le même département, et refuser les trois pour un accent
      // rendrait l'import inutilisable.
      departements: new Map(
        departements.flatMap((row) => [
          [normalizeKey(row.name), row],
          [normalizeKey(row.code), row],
        ]),
      ),
      iefs: new Map(
        iefs.flatMap((row) => [
          [normalizeKey(row.name), row],
          [normalizeKey(row.code), row],
        ]),
      ),
    };
  }

  /**
   * Lit le fichier téléversé, avec un plafond de taille APPLIQUÉ AU FLUX.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * LE PLAFOND EST PASSÉ À `request.file()`, PAS VÉRIFIÉ APRÈS
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `@fastify/multipart` est enregistré globalement dans `bootstrap.ts` avec le
   * plafond de l'APK Android, plusieurs centaines de mégaoctets. La version
   * précédente appelait `toBuffer()` d'abord et comparait la taille ENSUITE :
   * un envoi de 500 Mo était donc intégralement matérialisé en mémoire avant
   * d'être refusé, ce qui fait de ce contrôle un moyen d'épuiser le conteneur
   * plutôt qu'une protection contre lui.
   *
   * Le plafond propre à la route est donc remis à `request.file()`, qui le
   * transmet au parseur : le flux est coupé à 10 Mo, `truncated` passe à vrai,
   * et rien au-delà n'est jamais alloué.
   */
  private async readFile(request: FastifyRequest): Promise<Buffer> {
    let file: MultipartFile | undefined;
    try {
      file = await request.file({ limits: { fileSize: IMPORT_MAX_BYTES, files: 1 } });
    } catch {
      // `@fastify/multipart` peut lever quand la limite est franchie selon sa
      // configuration : on traite ce cas comme un dépassement et non comme un
      // fichier absent, sans quoi l'utilisateur lit « aucun fichier reçu »
      // après avoir envoyé un fichier de 500 Mo.
      throw new PayloadTooLargeException({
        code: 'REPRESENTANT_IMPORT_FILE_TOO_LARGE',
        message: `Le fichier dépasse ${String(Math.round(IMPORT_MAX_BYTES / 1_048_576))} Mo.`,
        maxBytes: IMPORT_MAX_BYTES,
      });
    }

    if (!file) {
      throw new BadRequestException({
        code: 'REPRESENTANT_IMPORT_FILE_MISSING',
        message: 'Aucun fichier reçu. Envoyez le classeur dans un champ `file`.',
      });
    }

    const buffer = await file.toBuffer();

    if (file.file.truncated || buffer.byteLength > IMPORT_MAX_BYTES) {
      throw new PayloadTooLargeException({
        code: 'REPRESENTANT_IMPORT_FILE_TOO_LARGE',
        message: `Le fichier dépasse ${String(Math.round(IMPORT_MAX_BYTES / 1_048_576))} Mo.`,
        maxBytes: IMPORT_MAX_BYTES,
      });
    }

    return buffer;
  }

  /** Lit la première feuille du classeur et en rend les cellules, ligne par ligne. */
  private async readSheet(buffer: Buffer): Promise<RawRow[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      // `load` est typé sur le `Buffer` de @types/node, dont la déclaration
      // exige un `ArrayBuffer` redimensionnable que `toBuffer()` ne promet pas.
      // La conversion est sans risque à l'exécution : exceljs ne fait que lire.
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch {
      throw new BadRequestException({
        code: 'REPRESENTANT_IMPORT_FILE_UNREADABLE',
        message: 'Le fichier n’est pas un classeur Excel lisible (.xlsx).',
      });
    }

    // La PREMIÈRE feuille, jamais celle qui porte un nom attendu : le modèle
    // fourni est souvent réenregistré depuis un autre tableur, qui renomme la
    // feuille au passage. Chercher « Représentants » ferait échouer un fichier
    // parfaitement valide.
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException({
        code: 'REPRESENTANT_IMPORT_SHEET_MISSING',
        message: 'Le classeur ne contient aucune feuille.',
      });
    }

    const rows: RawRow[] = [];

    // Le plafond de lignes est testé DANS la boucle, et non sur le tableau
    // rendu. Le tester après coup obligeait à matérialiser d'abord toutes les
    // lignes du classeur, cellule par cellule : un fichier de deux millions de
    // lignes tient sous les 10 Mo une fois compressé en .xlsx, et sa version
    // déployée en objets JavaScript épuisait la mémoire du conteneur AVANT
    // que le contrôle n'ait la moindre chance de s'exécuter. Le refus doit
    // arriver à la 5 001e ligne, pas à la dernière.
    // Drapeau porté par un objet et non par une variable : `eachRow` prend un
    // rappel, et l'analyse de flot ne suit pas une affectation faite à
    // l'intérieur. Une variable booléenne resterait typée « toujours fausse »
    // et le refus ci-dessous passerait pour du code mort.
    const state = { overflow: false };
    sheet.eachRow((row, line) => {
      if (state.overflow) return;
      if (line < FIRST_DATA_ROW) return;
      const cells = IMPORT_COLUMNS.map((_, index) => cellText(row.getCell(index + 1).value));
      // Une ligne entièrement vide est IGNORÉE et non rejetée : un classeur
      // rempli à la main en porte toujours quelques-unes en fin de fichier, et
      // les compter en erreur ferait paraître l'import cassé.
      if (cells.every((cell) => cell === '')) return;
      if (rows.length >= IMPORT_MAX_ROWS) {
        state.overflow = true;
        return;
      }
      rows.push({ line, cells });
    });

    if (state.overflow) {
      throw new BadRequestException({
        code: 'REPRESENTANT_IMPORT_TOO_MANY_ROWS',
        message: `Le fichier dépasse le plafond de ${String(IMPORT_MAX_ROWS)} lignes. Découpez-le.`,
        maxRows: IMPORT_MAX_ROWS,
      });
    }

    return rows;
  }
}

interface RawRow {
  readonly line: number;
  readonly cells: readonly string[];
}

interface FicheExistante {
  readonly id: string;
  readonly etablissement: string | null;
  readonly notes: string | null;
  readonly relationStatus: RepresentantRelation;
  readonly whatsappStatus: WhatsappStatus;
  readonly _count: { readonly repCallAttempts: number };
}

interface Enrichissement {
  readonly id: string;
  readonly champs: {
    etablissement?: string;
    notes?: string;
    relationStatus?: RepresentantRelation;
    whatsappStatus?: WhatsappStatus;
  };
  readonly appel: {
    readonly date: Date;
    readonly outcome: RepCallOutcome;
    readonly comment: string | null;
    readonly performedById: string;
  } | null;
}

/**
 * Ce que la ligne du fichier apporte à une fiche qui existe déjà. `null` si
 * elle n'apporte rien.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ON REMPLIT LE VIDE, ON N'ÉCRASE JAMAIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le fichier est une photo du terrain à une date ; la fiche, elle, a pu être
 * qualifiée depuis par un téléconseiller. Recopier le fichier par-dessus
 * ferait reculer ce travail : un représentant passé AMBASSADEUR le mois
 * dernier redeviendrait « refus » parce que le répertoire d'août le disait.
 *
 * D'où les gardes : un statut n'est posé que sur sa valeur PAR DÉFAUT
 * (`INCONNU`, `NON_DEMANDE`), qui signifie « la question n'a pas été
 * tranchée », et jamais sur une valeur déjà décidée. Et l'appel n'est ajouté
 * qu'aux fiches qui n'en portent AUCUN : sans clé d'idempotence dans le
 * classeur, un second passage créerait un doublon d'appel.
 */
/**
 * Analyse les lignes et écarte la PREMIÈRE famille de doublons : le fichier
 * contre lui-même.
 *
 * La SECONDE occurrence est rejetée, jamais la première : c'est celle du haut
 * du fichier que l'utilisateur reconnaît.
 */
function analyser(
  rows: readonly RawRow[],
  referentiels: Referentiels,
): { parsed: ParsedRow[]; errors: ImportRowErrorDto[]; duplicatesInFile: number } {
  const parsed: ParsedRow[] = [];
  const errors: ImportRowErrorDto[] = [];
  const seen = new Map<string, number>();
  let duplicatesInFile = 0;

  for (const raw of rows) {
    const outcome = parseRow(raw, referentiels);
    if ('code' in outcome) {
      errors.push(outcome);
      continue;
    }

    const previous = seen.get(outcome.phoneE164);
    if (previous !== undefined) {
      duplicatesInFile += 1;
      errors.push({
        line: outcome.line,
        code: 'DUPLICATE_IN_FILE',
        message: `Ce numéro figure déjà à la ligne ${String(previous)} du fichier.`,
        value: outcome.phoneE164,
      });
      continue;
    }

    seen.set(outcome.phoneE164, outcome.line);
    parsed.push(outcome);
  }

  return { parsed, errors, duplicatesInFile };
}

const refusDoublon = (row: ParsedRow, enrichir: boolean): ImportRowErrorDto => ({
  line: row.line,
  code: 'DUPLICATE_IN_DATABASE',
  message: enrichir
    ? 'Un représentant porte déjà ce numéro, et rien ne manque sur sa fiche.'
    : 'Un représentant porte déjà ce numéro en base.',
  value: row.phoneE164,
});

function enrichissementDe(
  row: ParsedRow,
  fiche: FicheExistante,
  appelantParDefautId: string,
): Enrichissement | null {
  const champs: Enrichissement['champs'] = {};
  if (row.etablissement !== null && !fiche.etablissement) champs.etablissement = row.etablissement;
  if (row.notes !== null && !fiche.notes) champs.notes = row.notes;
  if (
    row.relationStatus !== RepresentantRelation.INCONNU &&
    fiche.relationStatus === RepresentantRelation.INCONNU
  ) {
    champs.relationStatus = row.relationStatus;
  }
  if (
    row.whatsappStatus !== WhatsappStatus.NON_DEMANDE &&
    fiche.whatsappStatus === WhatsappStatus.NON_DEMANDE
  ) {
    champs.whatsappStatus = row.whatsappStatus;
  }

  const appel =
    row.appel !== null && fiche._count.repCallAttempts === 0
      ? { ...row.appel, performedById: row.ownerId ?? appelantParDefautId }
      : null;

  if (Object.keys(champs).length === 0 && appel === null) return null;
  return { id: fiche.id, champs, appel };
}

interface ReferentielRow {
  readonly id: string;
  readonly name: string;
}

interface IefRow extends ReferentielRow {
  readonly departementId: string;
}

interface Referentiels {
  readonly departements: ReadonlyMap<string, ReferentielRow>;
  readonly iefs: ReadonlyMap<string, IefRow>;
  readonly users: ReadonlyMap<string, { readonly id: string }>;
}

/** Texte d'une cellule, quel que soit son type. Une formule rend son résultat. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('result' in value) return cellText(value.result);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text)
        .join('')
        .trim();
    }
  }
  return '';
}

/** Analyse une ligne. Rend soit la ligne prête à écrire, soit son motif de refus. */
function parseRow(raw: RawRow, referentiels: Referentiels): ParsedRow | ImportRowErrorDto {
  // Par RANG dans le modèle, jamais par l'intitulé du fichier : un utilisateur
  // renomme une colonne bien plus souvent qu'il n'en déplace une. Une colonne
  // absente en fin de ligne se lit vide, et une cellule vide est simplement une
  // information qu'on n'a pas.
  const cellule = (rang: number): string => raw.cells[rang] ?? '';
  const fullName = cellule(0);
  const phone = cellule(1);
  const departement = cellule(2);
  const ief = cellule(3);
  const notes = cellule(4);
  const etablissement = cellule(5);
  const relation = cellule(6);
  const whatsapp = cellule(7);
  const charge = cellule(8);
  const dateAppel = cellule(9);
  const issue = cellule(10);

  if (fullName.length < 2) {
    return {
      line: raw.line,
      code: 'NAME_INVALID',
      message: 'Le nom complet est obligatoire (2 caractères au minimum).',
      value: fullName || null,
    };
  }

  const phoneE164 = tryNormalizePhone(phone);
  if (!phoneE164) {
    return {
      line: raw.line,
      code: 'PHONE_INVALID',
      message: 'Numéro de téléphone inexploitable.',
      value: phone || null,
    };
  }

  const departementRow = referentiels.departements.get(normalizeKey(departement));
  if (!departementRow) {
    return {
      line: raw.line,
      code: 'DEPARTEMENT_UNKNOWN',
      message: 'Département inconnu. Reprenez exactement un libellé de la liste déroulante.',
      value: departement || null,
    };
  }

  let iefRow: IefRow | null = null;
  if (ief) {
    iefRow = referentiels.iefs.get(normalizeKey(ief)) ?? null;
    if (!iefRow) {
      return {
        line: raw.line,
        code: 'IEF_UNKNOWN',
        message: 'IEF inconnue. Laissez la cellule vide si elle n’est pas connue.',
        value: ief,
      };
    }
    // Le département se DÉDUIT de l'IEF, jamais l'inverse. Une incohérence
    // entre les deux colonnes est une faute de saisie qu'il vaut mieux signaler
    // que trancher en silence : le rattachement décide du reporting terrain.
    if (iefRow.departementId !== departementRow.id) {
      return {
        line: raw.line,
        code: 'IEF_DEPARTEMENT_MISMATCH',
        message: `L’IEF « ${iefRow.name} » n’appartient pas au département « ${departementRow.name} ».`,
        value: ief,
      };
    }
  }

  const complements = parseComplements(
    { notes, relation, whatsapp, charge, dateAppel, issue },
    referentiels.users,
  );
  if ('code' in complements) {
    const { code, message, value } = complements;
    return { line: raw.line, code, message, value: value || null };
  }

  return {
    line: raw.line,
    fullName: fullName.slice(0, 160),
    phoneE164,
    departementId: departementRow.id,
    departementName: departementRow.name,
    iefId: iefRow?.id ?? null,
    iefName: iefRow?.name ?? null,
    notes: notes ? notes.slice(0, 2_000) : null,
    etablissement: etablissement ? etablissement.slice(0, 200) : null,
    ...complements,
  };
}

