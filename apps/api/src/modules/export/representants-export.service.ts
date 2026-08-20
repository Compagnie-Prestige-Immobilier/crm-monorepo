import type { Writable } from 'node:stream';

import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { readScope, readsEveryone } from '../../common/scope.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';
import { IMPORT_COLUMNS, IMPORT_SHEET_NAME } from '../representants/import-template.js';
import type { RepresentantExportQueryDto } from '../representants/dto.js';
import { RepresentantSortField } from '../representants/dto.js';
import {
  COMMON_TEMPLATE_RULES,
  styleHeader,
  writeImportTemplate,
} from './import-template.workbook.js';
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

  // Modèle vide

  /** Listes lues à la volée : un département désactivé ce matin ne doit plus y figurer. */
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

    await writeImportTemplate(stream, {
      sheetName: IMPORT_SHEET_NAME,
      columns: IMPORT_COLUMNS,
      // Colonnes 3 et 4 de `IMPORT_COLUMNS` : Département et IEF.
      dropdowns: [
        { column: 3, label: 'Départements', values: departements.map((row) => row.name) },
        { column: 4, label: 'IEF', values: iefs.map((row) => row.name) },
      ],
      rules: [
        ...COMMON_TEMPLATE_RULES,
        'Le téléphone est la clé de déduplication : un numéro déjà en base, ou répété dans le fichier, est signalé et non écrit.',
      ],
    });
  }

  // Export

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
      ...readScope(user),
      ...demoScope(demoEnabled),
    };

    if (query.commercialId) {
      where.createdById = readsEveryone(user)
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
