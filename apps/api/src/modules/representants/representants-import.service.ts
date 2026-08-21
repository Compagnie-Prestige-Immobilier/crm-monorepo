import { BadRequestException, Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import type { MultipartFile } from '@fastify/multipart';
import type { FastifyRequest } from 'fastify';
import ExcelJS from 'exceljs';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service.js';
import { tryNormalizePhone } from '../../common/phone.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { IMPORT_COLUMNS } from './import-template.js';
import type {
  ImportQueryDto,
  ImportReportDto,
  ImportRowErrorDto,
  ImportRowPreviewDto,
} from './dto.js';

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
    const buffer = await this.readFile(request);
    // Le plafond de lignes est appliqué DANS la lecture, pas après : voir
    // `readSheet`. Un classeur de deux millions de lignes n'a plus l'occasion
    // d'être matérialisé avant d'être refusé.
    const rows = await this.readSheet(buffer);

    const referentiels = await this.loadReferentiels();
    const errors: ImportRowErrorDto[] = [];
    const parsed: ParsedRow[] = [];
    let duplicates = 0;

    // Le téléphone déjà rencontré DANS LE FICHIER. Rempli au fil de la lecture,
    // pour que la seconde occurrence soit rejetée et non la première : c'est
    // celle du haut du fichier que l'utilisateur reconnaît.
    const seen = new Map<string, number>();

    for (const raw of rows) {
      const outcome = parseRow(raw, referentiels);
      if ('code' in outcome) {
        errors.push(outcome);
        continue;
      }

      const previous = seen.get(outcome.phoneE164);
      if (previous !== undefined) {
        duplicates += 1;
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

    // Le contrôle contre la base se fait en UNE requête, pas une par ligne : sur
    // 5 000 lignes, une lecture par ligne rendrait l'import inutilisable et
    // saturerait le pool de connexions.
    const known = await this.existingPhones(parsed.map((row) => row.phoneE164));
    const retained: ParsedRow[] = [];
    for (const row of parsed) {
      if (known.has(row.phoneE164)) {
        duplicates += 1;
        errors.push({
          line: row.line,
          code: 'DUPLICATE_IN_DATABASE',
          message: 'Un représentant porte déjà ce numéro en base.',
          value: row.phoneE164,
        });
        continue;
      }
      retained.push(row);
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
      errors: errors.slice(0, MAX_REPORTED_ERRORS),
      preview: retained.slice(0, MAX_PREVIEW_ROWS).map((row): ImportRowPreviewDto => ({
        line: row.line,
        fullName: row.fullName,
        phoneE164: row.phoneE164,
        departementName: row.departementName,
        iefName: row.iefName,
        notes: row.notes,
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
    const result = await this.prisma.$transaction(
      async (tx) =>
        tx.representant.createMany({
          data: rows.map((row) => ({
            // UUID v7 engendré ici : l'import n'a pas de client hors ligne, mais
            // l'identifiant doit rester du même format que ceux du mobile, sinon
            // l'ordre lexicographique cesse d'être l'ordre temporel.
            id: uuidv7(),
            fullName: row.fullName,
            phoneE164: row.phoneE164,
            departementId: row.departementId,
            iefId: row.iefId,
            notes: row.notes,
            createdById: user.id,
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
        }),
      { timeout: IMPORT_TRANSACTION_TIMEOUT_MS, maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS },
    );
    return result.count;
  }

  private async existingPhones(phones: readonly string[]): Promise<Set<string>> {
    const found = new Set<string>();
    const CHUNK = 1_000;

    for (let start = 0; start < phones.length; start += CHUNK) {
      const slice = phones.slice(start, start + CHUNK);
      const rows = await this.prisma.representant.findMany({
        where: { phoneE164: { in: slice }, deletedAt: null },
        select: { phoneE164: true },
      });
      for (const row of rows) found.add(row.phoneE164);
    }

    return found;
  }

  private async loadReferentiels(): Promise<Referentiels> {
    const [departements, iefs] = await Promise.all([
      this.prisma.departement.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.ief.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true, departementId: true },
      }),
    ]);

    return {
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
}

/**
 * Clé de rapprochement d'un libellé de référentiel.
 *
 * Accents retirés, casse effacée, ponctuation et espaces compactés. Un fichier
 * rempli à la main écrit « SAINT-LOUIS », « Saint Louis » et « saint  louis »
 * pour le même département : les trois doivent tomber sur la même clé, sans
 * quoi l'import rejette des lignes parfaitement correctes et l'utilisateur en
 * conclut que l'outil ne marche pas.
 */
export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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
  const [fullName = '', phone = '', departement = '', ief = '', notes = ''] = raw.cells;

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

  return {
    line: raw.line,
    fullName: fullName.slice(0, 160),
    phoneE164,
    departementId: departementRow.id,
    departementName: departementRow.name,
    iefId: iefRow?.id ?? null,
    iefName: iefRow?.name ?? null,
    notes: notes ? notes.slice(0, 2_000) : null,
  };
}
