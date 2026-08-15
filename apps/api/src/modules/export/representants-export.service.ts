import type { Writable } from 'node:stream';

import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CPI_BURGUNDY_ARGB } from '../../common/brand.js';
import { isAdmin, ownerScope } from '../../common/scope.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';
import {
  IMPORT_COLUMNS,
  IMPORT_SHEET_NAME,
  INSTRUCTIONS_SHEET_NAME,
  LISTS_SHEET_NAME,
} from '../representants/import-template.js';
import type { RepresentantExportQueryDto } from '../representants/dto.js';
import { RepresentantSortField } from '../representants/dto.js';
import { markWorkbook, writeDemoWarningRow } from './demo-marking.js';
import { toDakarCell } from './dakar.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';

/**
 * Deux classeurs, un seul module : le MODÈLE VIDE et l'EXPORT.
 *
 * Ils vivent ensemble parce qu'ils décrivent la même chose vue des deux côtés.
 * Le modèle dit ce qu'on peut faire entrer, l'export dit ce qui est entré, et
 * les deux partagent la définition des colonnes d'import. Les séparer ferait
 * inévitablement dériver l'un des deux au premier ajout de colonne.
 */

const DATE_FORMAT = 'dd/mm/yyyy hh:mm';
const PAGE_SIZE = 500;

/** Gris de la ligne d'exemple : elle doit se voir comme un exemple, pas comme une donnée. */
const SAMPLE_GREY = 'FF9A9A9A';
const SAMPLE_BACKGROUND = 'FFF3F3F3';

interface ExportColumn {
  readonly header: string;
  readonly key: string;
  readonly width: number;
  /** Les colonnes d'horodatage reçoivent le format d'affichage et l'heure de Dakar. */
  readonly isDate?: boolean;
}

/**
 * Colonnes de l'export.
 *
 * Distinctes de `IMPORT_COLUMNS` : l'export porte des champs calculés que
 * l'import ne peut pas recevoir (commercial propriétaire, nombre de prospects,
 * date d'arrivée en base). Confondre les deux listes rendrait le fichier
 * exporté irrecevable par l'import, ce qui est précisément l'aller-retour que
 * l'utilisateur essaiera en premier.
 */
const EXPORT_COLUMNS: readonly ExportColumn[] = [
  { header: 'Nom complet', key: 'fullName', width: 30 },
  { header: 'Téléphone', key: 'phone', width: 20 },
  { header: 'Département', key: 'departement', width: 24 },
  { header: 'IEF', key: 'ief', width: 26 },
  { header: 'Commercial', key: 'commercial', width: 26 },
  { header: 'Prospects', key: 'prospects', width: 12 },
  { header: 'Notes', key: 'notes', width: 40 },
  { header: 'Saisi le', key: 'clientCreatedAt', width: 20, isDate: true },
  { header: 'Créé en base le', key: 'createdAt', width: 20, isDate: true },
];

@Injectable()
export class RepresentantsExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Modèle vide
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Modèle d'import : en-têtes figés, ligne d'exemple grisée, instructions et
   * listes déroulantes alimentées depuis les référentiels VIVANTS.
   *
   * Les listes sont construites à la volée et non figées dans un fichier
   * commité : un département désactivé ou une IEF ajoutée doit se refléter dans
   * le modèle téléchargé le jour même, sinon l'utilisateur remplit des valeurs
   * que l'import rejettera ensuite une par une.
   *
   * Écrit dans un `Workbook` ordinaire et non un `WorkbookWriter` : le modèle
   * pèse quelques kilooctets, et la validation de données par plage n'est pas
   * disponible sur le writer en flux.
   */
  async writeTemplate(stream: Writable): Promise<void> {
    const [departements, iefs] = await Promise.all([
      this.prisma.departement.findMany({
        where: { isActive: true },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.ief.findMany({
        where: { isActive: true },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CPI GO';
    workbook.created = new Date();

    // ─ Feuille de saisie ─
    const sheet = workbook.addWorksheet(IMPORT_SHEET_NAME, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = IMPORT_COLUMNS.map((column) => ({
      header: column.header,
      key: column.header,
      width: column.width,
    }));
    styleHeader(sheet, IMPORT_COLUMNS.length);

    const sample = sheet.addRow(IMPORT_COLUMNS.map((column) => column.sample));
    sample.font = { italic: true, color: { argb: SAMPLE_GREY } };
    sample.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SAMPLE_BACKGROUND } };

    // ─ Feuille technique des listes, masquée ─
    const lists = workbook.addWorksheet(LISTS_SHEET_NAME);
    lists.state = 'veryHidden';
    lists.getColumn(1).values = ['Départements', ...departements.map((row) => row.name)];
    lists.getColumn(2).values = ['IEF', ...iefs.map((row) => row.name)];

    // La validation couvre une plage LARGE et non les seules lignes existantes :
    // l'utilisateur colle mille lignes d'un coup, et une validation bornée à la
    // ligne d'exemple ne s'appliquerait à aucune d'elles.
    const lastRow = 1_000;
    applyListValidation(
      sheet,
      3,
      lastRow,
      `${LISTS_SHEET_NAME}!$A$2:$A$${String(departements.length + 1)}`,
    );
    applyListValidation(
      sheet,
      4,
      lastRow,
      `${LISTS_SHEET_NAME}!$B$2:$B$${String(iefs.length + 1)}`,
    );

    // ─ Feuille Instructions ─
    const help = workbook.addWorksheet(INSTRUCTIONS_SHEET_NAME);
    help.columns = [
      { header: 'Colonne', key: 'column', width: 22 },
      { header: 'Obligatoire', key: 'required', width: 14 },
      { header: 'À savoir', key: 'help', width: 90 },
    ];
    styleHeader(help, 3);
    for (const column of IMPORT_COLUMNS) {
      help.addRow({
        column: column.header,
        required: column.required ? 'Oui' : 'Non',
        help: column.help,
      });
    }
    help.addRow({});
    const rules = help.addRow({ column: 'Règles générales' });
    rules.font = { bold: true, color: { argb: CPI_BURGUNDY_ARGB } };
    for (const line of [
      'Ne modifiez ni l’ordre ni le nombre des colonnes : le fichier est relu par position, pas par le texte de l’en-tête.',
      'La ligne 2 est un exemple grisé : elle n’est JAMAIS lue à l’import. Laissez-la en place et commencez votre saisie en ligne 3.',
      'Les lignes entièrement vides sont ignorées, pas comptées en erreur.',
      'Le téléphone est la clé de déduplication : un numéro déjà en base, ou répété dans le fichier, est signalé et non écrit.',
      'L’import se fait en deux temps : une simulation qui liste les erreurs ligne par ligne, puis l’application, qui écrit tout ou rien.',
    ]) {
      help.addRow({ help: line });
    }

    await workbook.xlsx.write(stream);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Export
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Export des représentants, avec EXACTEMENT le filtre de la liste.
   *
   * Écrit au fil de l'eau par `WorkbookWriter` et lu en pagination keyset : à
   * aucun instant plus de `PAGE_SIZE` lignes ne coexistent côté Node, quel que
   * soit le volume exporté.
   */
  async writeRepresentants(
    user: AuthenticatedUser,
    query: RepresentantExportQueryDto,
    stream: Writable,
  ): Promise<void> {
    const demoEnabled = await this.demo.enabled();
    const where = this.buildWhere(user, query, demoEnabled);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true });
    markWorkbook(workbook, demoEnabled);

    const sheet = workbook.addWorksheet(IMPORT_SHEET_NAME, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = EXPORT_COLUMNS.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width,
      ...(column.isDate ? { style: { numFmt: DATE_FORMAT } } : {}),
    }));
    styleHeader(sheet, EXPORT_COLUMNS.length);
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: EXPORT_COLUMNS.length },
    };
    writeDemoWarningRow(sheet, demoEnabled, EXPORT_COLUMNS.length);

    let after: string | undefined;
    for (;;) {
      const rows = await this.prisma.representant.findMany({
        where: after ? { AND: [where, { id: { gt: after } }] } : where,
        include: {
          departement: { select: { name: true } },
          ief: { select: { name: true } },
          createdBy: { select: { fullName: true } },
          _count: { select: { prospects: { where: { deletedAt: null } } } },
        },
        orderBy: { id: 'asc' },
        take: PAGE_SIZE,
      });
      if (rows.length === 0) break;

      for (const row of rows) {
        sheet
          .addRow({
            fullName: row.fullName,
            phone: row.phoneE164,
            departement: row.departement.name,
            ief: row.ief?.name ?? '',
            commercial: row.createdBy.fullName,
            prospects: row._count.prospects,
            notes: row.notes ?? '',
            clientCreatedAt: toDakarCell(row.clientCreatedAt),
            createdAt: toDakarCell(row.createdAt),
          })
          .commit();
      }

      after = rows.at(-1)?.id;
      if (rows.length < PAGE_SIZE) break;
    }

    sheet.commit();
    await workbook.commit();
  }

  /**
   * Clause de filtrage, MOT POUR MOT celle de la liste.
   *
   * Elle est reconstruite ici plutôt qu'importée du service des représentants
   * parce que le module `export` ne doit pas dépendre du module métier ; la
   * cohérence est vérifiée par le test de cohérence de filtres, pas par la
   * discipline de celui qui écrira la prochaine colonne.
   */
  private buildWhere(
    user: AuthenticatedUser,
    query: RepresentantExportQueryDto,
    demoEnabled: boolean,
  ): Prisma.RepresentantWhereInput {
    const where: Prisma.RepresentantWhereInput = {
      deletedAt: null,
      ...ownerScope(user),
      ...demoScope(demoEnabled),
    };

    if (query.commercialId) {
      where.createdById = isAdmin(user)
        ? query.commercialId
        : query.commercialId === user.id
          ? user.id
          : '__aucun__';
    }
    if (query.departementId) where.departementId = query.departementId;
    if (query.iefId) where.iefId = query.iefId;

    if (query.dateFrom || query.dateTo) {
      where.clientCreatedAt = {
        ...(query.dateFrom ? { gte: inclusiveDateFrom(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: inclusiveDateTo(query.dateTo) } : {}),
      };
    }

    if (query.hasProspects === true) where.prospects = { some: { deletedAt: null } };
    if (query.hasProspects === false) where.prospects = { none: { deletedAt: null } };

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phoneE164: { contains: search.replace(/[^\d+]/g, '') } },
      ];
    }

    return where;
  }
}

/** Champs de tri exposés, réexportés pour que le test de cohérence les compare. */
export const REPRESENTANT_SORT_FIELDS = Object.values(RepresentantSortField);

function styleHeader(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CPI_BURGUNDY_ARGB } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  header.height = 22;
  for (let column = 1; column <= columnCount; column += 1) {
    header.getCell(column).border = {
      bottom: { style: 'thin', color: { argb: CPI_BURGUNDY_ARGB } },
    };
  }
  header.commit();
}

/** Liste déroulante sur une colonne entière, de `from` à `to`. */
function applyListValidation(
  sheet: ExcelJS.Worksheet,
  column: number,
  lastRow: number,
  formula: string,
): void {
  for (let row = 2; row <= lastRow; row += 1) {
    sheet.getCell(row, column).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      // `showErrorMessage` sans `error: true` : la liste GUIDE, elle n'interdit
      // pas. Un utilisateur peut avoir un libellé légitime absent du
      // référentiel du jour, et le serveur reste seul juge à l'import.
      showErrorMessage: false,
    };
  }
}
