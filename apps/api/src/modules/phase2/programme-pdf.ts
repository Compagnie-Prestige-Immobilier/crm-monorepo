import type { Writable } from 'node:stream';

import PDFDocument from 'pdfkit';

import { CPI_BURGUNDY, CPI_RULE_GREY, CPI_ZEBRA, cpiLogo } from '../../common/brand.js';

export interface ProgrammeRow {
  readonly position: number;
  readonly shortCode: string;
  readonly phoneE164: string;
}

export interface CheckboxGroup {
  readonly caption: string;
  readonly options: readonly string[];
}

export interface ProgrammeData {
  readonly campaignName: string;
  readonly commercialName: string;
  readonly segmentLabel: string;
  readonly generatedAt: Date;
  readonly rows: readonly ProgrammeRow[];
  readonly dayNumber?: number;
  readonly dayCount?: number;

  readonly title?: string;
  readonly scopeCaption?: string;
  readonly checkboxGroups?: readonly CheckboxGroup[];
}

const METHOD_LABELS = ['Plateforme', 'Physique', 'Voix ou messagerie électronique'] as const;

const OTHER_OUTCOME_LABELS = ['Injoignable', 'Rappeler', 'Refus', 'Faux numéro', 'Autre'] as const;

export const PROSPECT_CHECKBOX_GROUPS: readonly CheckboxGroup[] = [
  { caption: 'Méthode', options: METHOD_LABELS },
  { caption: 'Autre', options: OTHER_OUTCOME_LABELS },
];

const MARGIN = 28;

const BODY_SIZE = 14;

const CHECKBOX_SIZE = 9.5;

const BOX_SIZE = 12;
const BOX_LABEL_GAP = 4;
const CHECKBOX_GAP = 9;

const ROW_HEIGHT = 46;

const BAND_HEIGHT = 76;

const BAND_GAP = 12;

const COLUMN_HEADER_HEIGHT = 26;

const FOOTER_SPACE = 22;

const TEXT_PAD = 7;

interface Column {
  readonly key: 'order' | 'code' | 'phone' | 'result';
  readonly header: string;
  readonly width: number;
}

const COLUMNS: readonly Column[] = [
  { key: 'order', header: 'N°', width: 36 },
  { key: 'code', header: 'Code', width: 78 },
  { key: 'phone', header: 'Téléphone', width: 124 },
  { key: 'result', header: 'Résultat de l’appel, cocher une seule case', width: 0 },
];

function columnBounds(pageWidth: number): { column: Column; left: number; right: number }[] {
  const available = pageWidth - 2 * MARGIN;
  const fixed = COLUMNS.reduce((sum, column) => sum + column.width, 0);

  let cursor = MARGIN;
  return COLUMNS.map((column) => {
    const width = column.width > 0 ? column.width : available - fixed;
    const bounds = { column, left: cursor, right: cursor + width };
    cursor += width;
    return bounds;
  });
}

export function formatDakar(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Dakar',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

export function programmeFilename(
  data: Pick<ProgrammeData, 'generatedAt'> & { readonly dayNumber?: number },
): string {
  const date = data.generatedAt.toISOString().slice(0, 10);
  const day = data.dayNumber === undefined ? '' : `-jour-${String(data.dayNumber)}`;
  return `programme-appels-${date}${day}.pdf`;
}

type Doc = InstanceType<typeof PDFDocument>;

function checkbox(doc: Doc, x: number, y: number, label: string): number {
  doc.lineWidth(0.8).rect(x, y, BOX_SIZE, BOX_SIZE).stroke('#5a5a5a');
  const textX = x + BOX_SIZE + BOX_LABEL_GAP;
  doc.fillColor('#111111').text(label, textX, y + (BOX_SIZE - CHECKBOX_SIZE) / 2 + 0.5, {
    lineBreak: false,
  });
  return BOX_SIZE + BOX_LABEL_GAP + doc.widthOfString(label);
}

function checkboxRow(doc: Doc, x: number, y: number, labels: readonly string[]): number {
  let cursor = x;
  for (const label of labels) {
    cursor += checkbox(doc, cursor, y, label) + CHECKBOX_GAP;
  }
  return cursor;
}

function drawBand(doc: Doc, data: ProgrammeData): void {
  const width = doc.page.width;
  doc.rect(0, 0, width, BAND_HEIGHT + MARGIN).fill(CPI_BURGUNDY);

  let textLeft = MARGIN;
  const logo = cpiLogo();
  if (logo) {
    const logoHeight = 44;
    doc.image(logo, MARGIN, 18, { height: logoHeight });
    textLeft = MARGIN + logoHeight * 2.6 + 18;
  }

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff');
  doc.text(data.title ?? 'Programme d’appels', textLeft, 20, { lineBreak: false });

  const metaWidth = width - textLeft - MARGIN;
  doc.font('Helvetica').fontSize(11).fillColor('#f3e4e7');
  for (const [index, line] of metaLines(data).entries()) {
    doc.text(line, textLeft, 47 + index * 15, {
      lineBreak: false,
      width: metaWidth,
      ellipsis: true,
    });
  }
}

function metaLines(data: ProgrammeData): string[] {
  const identity = [
    data.campaignName,
    `Commercial : ${data.commercialName}`,
    `${data.scopeCaption ?? 'Base'} : ${data.segmentLabel}`,
  ];
  if (data.dayNumber !== undefined && data.dayCount !== undefined) {
    identity.push(`Jour ${String(data.dayNumber)} sur ${String(data.dayCount)}`);
  }

  return [
    identity.join('   ·   '),
    [
      `Total : ${String(data.rows.length)} lignes`,
      `Édité le ${formatDakar(data.generatedAt)} (heure de Dakar)`,
    ].join('   ·   '),
    'Document sans nom : chaque ligne se rapproche de sa fiche par son code.',
  ];
}

const verticals = (
  bounds: readonly { readonly left: number }[],
  right: number,
): readonly number[] => [...bounds.map((bound) => bound.left), right];

function drawColumnHeader(doc: Doc, y: number): number {
  const bounds = columnBounds(doc.page.width);
  const left = MARGIN;
  const right = doc.page.width - MARGIN;

  doc.rect(left, y, right - left, COLUMN_HEADER_HEIGHT).fill('#ede7e8');

  doc.font('Helvetica-Bold').fontSize(10).fillColor(CPI_BURGUNDY);
  for (const bound of bounds) {
    doc.text(bound.column.header, bound.left + TEXT_PAD, y + 8, { lineBreak: false });
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
    .moveTo(left, y + COLUMN_HEADER_HEIGHT)
    .lineTo(right, y + COLUMN_HEADER_HEIGHT)
    .stroke(CPI_BURGUNDY);

  return y + COLUMN_HEADER_HEIGHT;
}

function drawRow(
  doc: Doc,
  y: number,
  row: ProgrammeRow,
  index: number,
  groups: readonly CheckboxGroup[],
): void {
  const bounds = columnBounds(doc.page.width);
  const left = MARGIN;
  const right = doc.page.width - MARGIN;

  if (index % 2 === 1) {
    doc.rect(left, y, right - left, ROW_HEIGHT).fill(CPI_ZEBRA);
  }

  doc.lineWidth(0.5);
  for (const x of verticals(bounds, right)) {
    doc
      .moveTo(x, y)
      .lineTo(x, y + ROW_HEIGHT)
      .stroke(CPI_RULE_GREY);
  }
  doc
    .moveTo(left, y + ROW_HEIGHT)
    .lineTo(right, y + ROW_HEIGHT)
    .stroke(CPI_RULE_GREY);

  const cell = (key: Column['key']): number =>
    bounds.find((bound) => bound.column.key === key)?.left ?? MARGIN;

  const textY = y + (ROW_HEIGHT - BODY_SIZE) / 2 - 1;
  doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#111111');
  doc.text(String(row.position), cell('order') + TEXT_PAD, textY, { lineBreak: false });
  doc
    .font('Helvetica-Bold')
    .fillColor(CPI_BURGUNDY)
    .text(row.shortCode, cell('code') + TEXT_PAD, textY, { lineBreak: false });
  doc
    .font('Helvetica')
    .fillColor('#111111')
    .text(row.phoneE164, cell('phone') + TEXT_PAD, textY, { lineBreak: false });

  drawResultCell(doc, y, cell('result') + TEXT_PAD, right - TEXT_PAD, groups);
}

function drawResultCell(
  doc: Doc,
  y: number,
  left: number,
  right: number,
  groups: readonly CheckboxGroup[],
): void {
  doc.font('Helvetica').fontSize(CHECKBOX_SIZE);

  const captionWidth = Math.max(...groups.map((group) => doc.widthOfString(group.caption)), 0) + 8;

  let lineY = y + 7;
  let afterBoxes = left + captionWidth;

  for (const group of groups) {
    doc.fillColor('#7a6b6e').text(group.caption, left, lineY + 2, { lineBreak: false });
    afterBoxes = checkboxRow(doc, left + captionWidth, lineY, group.options);
    lineY += BOX_SIZE + 7;
  }

  const commentY = lineY - BOX_SIZE - 7;
  doc.fillColor('#7a6b6e').text('Commentaire', afterBoxes + 4, commentY + 2, { lineBreak: false });
  const ruleStart = afterBoxes + 4 + doc.widthOfString('Commentaire') + 6;
  if (ruleStart < right) {
    doc
      .lineWidth(0.5)
      .moveTo(ruleStart, commentY + BOX_SIZE)
      .lineTo(right, commentY + BOX_SIZE)
      .stroke('#9a8f91');
  }
}

export interface ProgrammePdfOptions {
  readonly compress?: boolean;
}

export function writeProgrammePdf(
  out: Writable,
  data: ProgrammeData,
  options: ProgrammePdfOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: MARGIN,
      compress: options.compress ?? true,
      info: {
        Title: `${data.title ?? 'Programme d’appels'} : ${data.campaignName} / ${data.commercialName}`,
        Author: 'CRM Prospection CPI',
        CreationDate: data.generatedAt,
      },
    });

    doc.on('error', reject);
    out.on('error', reject);
    doc.pipe(out);
    out.on('finish', () => {
      resolve();
    });

    const groups = data.checkboxGroups ?? PROSPECT_CHECKBOX_GROUPS;
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
      drawRow(doc, y, row, index, groups);
      y += ROW_HEIGHT;
      placed += 1;
    }

    if (data.rows.length === 0) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(12)
        .fillColor('#7a6b6e')
        .text('Aucune ligne affectée à ce commercial.', MARGIN + TEXT_PAD, y + 14, {
          lineBreak: false,
        });
    }

    doc.end();
  });
}

const capacity = (bottom: number, top: number): number =>
  Math.max(1, Math.floor((bottom - top - COLUMN_HEADER_HEIGHT) / ROW_HEIGHT));
