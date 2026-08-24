import type { Writable } from 'node:stream';

import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

import { PrismaService } from '../../prisma/prisma.service.js';
import { WorkspaceContext } from '../../workspaces/workspace.js';
import { VisitesService } from '../visites/visites.service.js';
import type { VisiteFilterDto } from '../visites/dto.js';
import {
  VISITES_REGISTRE_COLUMNS,
  VISITES_REGISTRE_HEADERS,
  VISITES_REGISTRE_SHEET,
} from '../imports/visites-registre.template.js';
import { markWorkbook, writeDemoWarningRow } from './demo-marking.js';
import { toDakarCell } from './dakar.js';
import { styleHeader } from './import-template.workbook.js';

const H = VISITES_REGISTRE_HEADERS;

const PAGE_SIZE = 500;

/** Formats à l'export, colonne par colonne. `@` = texte, jamais réinterprété par Excel. */
const COLUMN_FORMATS: Readonly<Record<string, string>> = {
  [H.numero]: '@',
  [H.heure]: '@',
  [H.telephone]: '@',
  [H.date]: 'dd/mm/yyyy',
  [H.saisieLe]: 'dd/mm/yyyy hh:mm',
};

const VISITE_INCLUDE = {
  entreprise: { select: { label: true } },
  direction: { select: { label: true } },
  destinataire: { select: { label: true } },
  objet: { select: { label: true } },
} as const;

/** Le jour de la visite à Dakar, à MINUIT : jamais l'instant. Sérialisé en fraction sinon. */
function dateOnlyCell(instant: Date): Date {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day));
}

/** L'heure murale de Dakar, en `14:30` : jamais la fraction de journée qu'Excel y verrait. */
function timeCell(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Dakar',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

const RAPPEL_TEXT = 'N° REGISTRE vide = nouvelle visite. Ne renommez ni ne déplacez les colonnes.';

/**
 * La ligne 2 porte TOUJOURS un rappel, démonstration ou non : `projectRows`
 * (`xlsx-rows.ts`) saute tout ce qui précède `FIRST_DATA_ROW` (3). Zéro ligne de
 * remplissage ferait disparaître la première visite du classeur sans un mot.
 */
function writeRappelRow(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const row = sheet.addRow([RAPPEL_TEXT]);
  row.font = { italic: true, color: { argb: 'FF6B6B6B' }, size: 10 };
  row.alignment = { vertical: 'middle', horizontal: 'left' };

  if (columnCount > 1) {
    try {
      sheet.mergeCells(row.number, 1, row.number, columnCount);
    } catch {
      // Sans fusion le texte deborde sur les cellules vides voisines : lisible.
    }
  }
  row.commit();
}

@Injectable()
export class VisitesExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visites: VisitesService,
    private readonly demo: WorkspaceContext,
  ) {}

  /**
   * Export du registre, avec EXACTEMENT le filtre de l'écran. Ce classeur est
   * conçu pour revenir : il porte les onze colonnes que `visites-registre.
   * adapter.ts` sait relire, `N° REGISTRE` en tête.
   */
  async writeVisites(query: VisiteFilterDto, stream: Writable): Promise<void> {
    const demoEnabled = this.demo.current() === 'demo';
    const where = this.visites.buildWhere(query);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true });
    markWorkbook(workbook, demoEnabled);

    const sheet = workbook.addWorksheet(VISITES_REGISTRE_SHEET, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = VISITES_REGISTRE_COLUMNS.map((column) => ({
      header: column.header,
      key: column.header,
      width: column.width,
      ...(column.header in COLUMN_FORMATS
        ? { style: { numFmt: COLUMN_FORMATS[column.header] as string } }
        : {}),
    }));
    styleHeader(sheet, VISITES_REGISTRE_COLUMNS.length);
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: VISITES_REGISTRE_COLUMNS.length },
    };
    if (demoEnabled) {
      writeDemoWarningRow(sheet, true, VISITES_REGISTRE_COLUMNS.length);
    } else {
      writeRappelRow(sheet, VISITES_REGISTRE_COLUMNS.length);
    }

    let after: string | undefined;
    for (;;) {
      const rows = await this.prisma.visite.findMany({
        where: after ? { AND: [where, { reference: { gt: after } }] } : where,
        include: VISITE_INCLUDE,
        orderBy: { reference: 'asc' },
        take: PAGE_SIZE,
      });
      if (rows.length === 0) break;

      for (const row of rows) {
        sheet
          .addRow({
            [H.numero]: row.reference,
            [H.date]: dateOnlyCell(row.visitedAt),
            [H.heure]: row.timeKnown ? timeCell(row.visitedAt) : '',
            [H.nom]: row.visitorName,
            [H.telephone]: row.phone ?? '',
            [H.entreprise]: row.entreprise.label,
            [H.direction]: row.direction?.label ?? '',
            [H.destinataire]: row.destinataire?.label ?? '',
            [H.objet]: row.objet.label,
            [H.commentaire]: row.comment ?? '',
            [H.saisieLe]: toDakarCell(row.createdAt),
          })
          .commit();
      }

      after = rows.at(-1)?.reference;
      if (rows.length < PAGE_SIZE) break;
    }

    sheet.commit();
    await workbook.commit();
  }
}
