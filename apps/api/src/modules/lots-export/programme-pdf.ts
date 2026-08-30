import type { Writable } from 'node:stream';

import PDFDocument from 'pdfkit';

import { CPI_BURGUNDY, CPI_RULE_GREY, CPI_ZEBRA, cpiLogo } from '../../common/brand.js';

export interface ProgrammeRow {
  readonly position: number;
  readonly nom: string;
  readonly prenom: string;
  readonly phoneE164: string;
}

export interface ProgrammeData {
  readonly teleconseillerName: string;
  readonly dayNumber: number;
  readonly dayCount: number;
  readonly lotName: string;
  readonly cibleLabel: string;
  readonly generatedAt: Date;
  readonly rows: readonly ProgrammeRow[];
}

export interface ProgrammePdfOptions {
  readonly compress?: boolean;
}

/** 15 mm de marge, lignes de 9 mm, corps 11 : 50 fiches tiennent sur deux pages. */
const MARGIN = 42.5;
const ROW_HEIGHT = 25;
const BODY_SIZE = 11;
const COLUMN_HEADER_HEIGHT = 24;
const FOOTER_SPACE = 20;
const BAND_HEIGHT = 62;
const BAND_GAP = 12;
const TEXT_PAD = 7;

interface Column {
  readonly key: 'order' | 'nom' | 'prenom' | 'phone';
  readonly header: string;
  readonly width: number;
}

const COLUMNS: readonly Column[] = [
  { key: 'order', header: 'N°', width: 44 },
  { key: 'nom', header: 'Nom', width: 176 },
  { key: 'prenom', header: 'Prénom', width: 150 },
  { key: 'phone', header: 'Téléphone', width: 0 },
];

type Doc = InstanceType<typeof PDFDocument>;

interface Bound {
  readonly column: Column;
  readonly left: number;
  readonly right: number;
}

function columnBounds(pageWidth: number): Bound[] {
  const available = pageWidth - 2 * MARGIN;
  const fixed = COLUMNS.reduce((sum, column) => sum + column.width, 0);

  let cursor = MARGIN;
  return COLUMNS.map((column) => {
    const width = column.width > 0 ? column.width : available - fixed;
    const bound = { column, left: cursor, right: cursor + width };
    cursor += width;
    return bound;
  });
}

export function formatDakar(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Dakar',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

export function formatPhone(phoneE164: string): string {
  return phoneE164.replace(/^(\+221)(\d{2})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5');
}

export function programmeFilename(data: {
  readonly teleconseillerName: string;
  readonly dayNumber: number;
}): string {
  const slug =
    data.teleconseillerName
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'teleconseiller';
  return `programme-${slug}-jour-${String(data.dayNumber)}.pdf`;
}

function drawBand(doc: Doc, data: ProgrammeData): void {
  const width = doc.page.width;
  doc.rect(0, 0, width, MARGIN + BAND_HEIGHT).fill(CPI_BURGUNDY);

  let textLeft = MARGIN;
  const logo = cpiLogo();
  if (logo) {
    doc.image(logo, MARGIN, 16, { height: 38 });
    textLeft = 150;
  }
  const textWidth = width - textLeft - MARGIN;

  doc.font('Helvetica').fontSize(10).fillColor('#f3e4e7');
  doc.text('Programme d’appel', textLeft, 16, { width: textWidth, height: 12, ellipsis: true });

  doc.font('Helvetica-Bold').fontSize(21).fillColor('#ffffff');
  doc.text(data.teleconseillerName, textLeft, 30, {
    width: textWidth,
    height: 24,
    ellipsis: true,
  });

  doc.font('Helvetica').fontSize(10).fillColor('#f3e4e7');
  doc.text(
    `Jour ${String(data.dayNumber)} sur ${String(data.dayCount)}   ·   ${formatDakar(data.generatedAt)}`,
    textLeft,
    62,
    { width: textWidth, height: 12, ellipsis: true },
  );
  doc.fontSize(9);
  doc.text(`${data.lotName}   ·   ${data.cibleLabel}`, textLeft, 78, {
    width: textWidth,
    height: 11,
    ellipsis: true,
  });
}

const verticals = (bounds: readonly Bound[], right: number): readonly number[] => [
  ...bounds.map((bound) => bound.left),
  right,
];

function drawColumnHeader(doc: Doc, y: number): number {
  const bounds = columnBounds(doc.page.width);
  const right = doc.page.width - MARGIN;

  doc.rect(MARGIN, y, right - MARGIN, COLUMN_HEADER_HEIGHT).fill('#ede7e8');
  doc.font('Helvetica-Bold').fontSize(10).fillColor(CPI_BURGUNDY);
  for (const bound of bounds) {
    doc.text(bound.column.header, bound.left + TEXT_PAD, y + 7, { lineBreak: false });
  }

  doc.lineWidth(0.6);
  for (const x of verticals(bounds, right)) {
    doc
      .moveTo(x, y)
      .lineTo(x, y + COLUMN_HEADER_HEIGHT)
      .stroke(CPI_RULE_GREY);
  }
  doc
    .lineWidth(1)
    .moveTo(MARGIN, y + COLUMN_HEADER_HEIGHT)
    .lineTo(right, y + COLUMN_HEADER_HEIGHT)
    .stroke(CPI_BURGUNDY);

  return y + COLUMN_HEADER_HEIGHT;
}

function drawRow(doc: Doc, y: number, row: ProgrammeRow, index: number): void {
  const bounds = columnBounds(doc.page.width);
  const right = doc.page.width - MARGIN;

  if (index % 2 === 1) doc.rect(MARGIN, y, right - MARGIN, ROW_HEIGHT).fill(CPI_ZEBRA);

  doc.lineWidth(0.5);
  for (const x of verticals(bounds, right)) {
    doc
      .moveTo(x, y)
      .lineTo(x, y + ROW_HEIGHT)
      .stroke(CPI_RULE_GREY);
  }
  doc
    .moveTo(MARGIN, y + ROW_HEIGHT)
    .lineTo(right, y + ROW_HEIGHT)
    .stroke(CPI_RULE_GREY);

  const text = (key: Column['key'], value: string): void => {
    const bound = bounds.find((candidate) => candidate.column.key === key);
    if (!bound) return;
    doc.text(value, bound.left + TEXT_PAD, y + (ROW_HEIGHT - BODY_SIZE) / 2 - 1, {
      width: bound.right - bound.left - 2 * TEXT_PAD,
      height: BODY_SIZE + 3,
      ellipsis: true,
    });
  };

  doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#111111');
  text('order', String(row.position));
  text('nom', row.nom);
  text('prenom', row.prenom);
  text('phone', formatPhone(row.phoneE164));
}

const capacity = (bottom: number, top: number): number =>
  Math.max(1, Math.floor((bottom - top - COLUMN_HEADER_HEIGHT) / ROW_HEIGHT));

export function writeProgrammePdf(
  out: Writable,
  data: ProgrammeData,
  options: ProgrammePdfOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margin: MARGIN,
      compress: options.compress ?? true,
      info: {
        Title: `Programme d’appel : ${data.teleconseillerName}, jour ${String(data.dayNumber)}`,
        Author: 'CRM Prospection CPI',
        CreationDate: data.generatedAt,
      },
    });

    doc.on('error', reject);
    out.on('error', reject);
    out.on('finish', () => {
      resolve();
    });
    doc.pipe(out);

    const bottom = doc.page.height - MARGIN - FOOTER_SPACE;
    const firstTop = MARGIN + BAND_HEIGHT + BAND_GAP;
    const firstCapacity = capacity(bottom, firstTop);
    const otherCapacity = capacity(bottom, MARGIN);
    const totalPages =
      data.rows.length <= firstCapacity
        ? 1
        : 1 + Math.ceil((data.rows.length - firstCapacity) / otherCapacity);

    let pageNumber = 1;
    const footer = (): void => {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#8a8a8a')
        .text(
          `Page ${String(pageNumber)} / ${String(totalPages)}`,
          MARGIN,
          doc.page.height - MARGIN - 10,
          { lineBreak: false },
        );
    };

    drawBand(doc, data);
    let y = drawColumnHeader(doc, firstTop);
    let placed = 0;
    let capacityHere = firstCapacity;
    footer();

    for (const [index, row] of data.rows.entries()) {
      if (placed === capacityHere) {
        doc.addPage();
        pageNumber += 1;
        y = drawColumnHeader(doc, MARGIN);
        placed = 0;
        capacityHere = otherCapacity;
        footer();
      }
      drawRow(doc, y, row, index);
      y += ROW_HEIGHT;
      placed += 1;
    }

    if (data.rows.length === 0) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(12)
        .fillColor('#7a6b6e')
        .text('Aucune fiche pour cette journée.', MARGIN + TEXT_PAD, y + 14, { lineBreak: false });
    }

    doc.end();
  });
}
