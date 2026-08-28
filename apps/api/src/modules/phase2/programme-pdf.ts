import type { Writable } from 'node:stream';

import PDFDocument from 'pdfkit';

import { CPI_BURGUNDY, CPI_RULE_GREY, CPI_ZEBRA, cpiLogo } from '../../common/brand.js';
import { ENROLLMENT_METHOD_LABELS, ENROLLMENT_METHOD_ORDER } from '../prospects/phase2-labels.js';
import { outcomeEffectRule } from '../referentiels/call-outcome-rules.js';

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
  readonly checkboxGroups: readonly CheckboxGroup[];
}

const METHOD_LABELS: readonly string[] = ENROLLMENT_METHOD_ORDER.map(
  (method) => ENROLLMENT_METHOD_LABELS[method],
);

/**
 * Les cases « Autre » sortent du référentiel : figées ici, elles mentiraient
 * dès le premier motif ajouté par l'administration, et le terrain cocherait à
 * côté. Le motif qui exige une méthode se coche dans le groupe « Méthode ».
 */
export function prospectCheckboxGroups(
  reasons: readonly { readonly label: string; readonly effect: string }[],
): readonly CheckboxGroup[] {
  return [
    { caption: 'Méthode', options: METHOD_LABELS },
    {
      caption: 'Autre',
      options: reasons
        .filter((reason) => !outcomeEffectRule(reason.effect).requiresMethod)
        .map((reason) => reason.label),
    },
  ];
}

const MARGIN = 28;

const BODY_SIZE = 14;

const CHECKBOX_SIZE = 9.5;

const BOX_SIZE = 12;
const BOX_LABEL_GAP = 4;
const CHECKBOX_GAP = 9;

const ROW_HEIGHT = 46;
const CHECKBOX_LINE_HEIGHT = BOX_SIZE + 7;
const CHECKBOX_TOP_PAD = 7;

const BAND_HEIGHT = 76;

const BAND_GAP = 12;

const COLUMN_HEADER_HEIGHT = 26;

const FOOTER_SPACE = 22;

const TEXT_PAD = 7;

const META_LINE_STEP = 15;
const COMMENT_CAPTION = 'Commentaire';
const COMMENT_RULE_MIN = 40;

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

interface ResultLine {
  readonly caption: string;
  readonly labels: string[];
}

interface ResultLayout {
  readonly captionWidth: number;
  readonly lines: readonly ResultLine[];
  readonly height: number;
}

/** Les motifs viennent de la base : la ligne se replie au lieu d'écrire hors page. */
function layoutResultCell(doc: Doc, groups: readonly CheckboxGroup[], width: number): ResultLayout {
  doc.font('Helvetica').fontSize(CHECKBOX_SIZE);
  const captionWidth = Math.max(...groups.map((group) => doc.widthOfString(group.caption)), 0) + 8;
  const available =
    width - captionWidth - doc.widthOfString(COMMENT_CAPTION) - 10 - COMMENT_RULE_MIN;

  const lines: ResultLine[] = [];
  for (const group of groups) {
    let line: ResultLine = { caption: group.caption, labels: [] };
    let used = 0;
    for (const label of group.options) {
      const cost = BOX_SIZE + BOX_LABEL_GAP + doc.widthOfString(label) + CHECKBOX_GAP;
      if (line.labels.length > 0 && used + cost > available) {
        lines.push(line);
        line = { caption: '', labels: [] };
        used = 0;
      }
      line.labels.push(label);
      used += cost;
    }
    lines.push(line);
  }

  return {
    captionWidth,
    lines,
    height: CHECKBOX_TOP_PAD + lines.length * CHECKBOX_LINE_HEIGHT + 1,
  };
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
  // pdfkit ne tronque à l'ellipse que si `height` est fourni : sans lui la ligne
  // se replie et recouvre la suivante dès qu'un nom de campagne est long.
  for (const [index, line] of metaLines(data).entries()) {
    doc.text(line, textLeft, 47 + index * META_LINE_STEP, {
      lineBreak: false,
      width: metaWidth,
      height: META_LINE_STEP,
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
  layout: ResultLayout,
  rowHeight: number,
): void {
  const bounds = columnBounds(doc.page.width);
  const left = MARGIN;
  const right = doc.page.width - MARGIN;

  if (index % 2 === 1) {
    doc.rect(left, y, right - left, rowHeight).fill(CPI_ZEBRA);
  }

  doc.lineWidth(0.5);
  for (const x of verticals(bounds, right)) {
    doc
      .moveTo(x, y)
      .lineTo(x, y + rowHeight)
      .stroke(CPI_RULE_GREY);
  }
  doc
    .moveTo(left, y + rowHeight)
    .lineTo(right, y + rowHeight)
    .stroke(CPI_RULE_GREY);

  const cell = (key: Column['key']): number =>
    bounds.find((bound) => bound.column.key === key)?.left ?? MARGIN;

  const textY = y + (rowHeight - BODY_SIZE) / 2 - 1;
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

  drawResultCell(doc, y, cell('result') + TEXT_PAD, right - TEXT_PAD, layout);
}

function drawResultCell(
  doc: Doc,
  y: number,
  left: number,
  right: number,
  layout: ResultLayout,
): void {
  doc.font('Helvetica').fontSize(CHECKBOX_SIZE);

  let lineY = y + CHECKBOX_TOP_PAD;
  let afterBoxes = left + layout.captionWidth;

  for (const line of layout.lines) {
    if (line.caption !== '') {
      doc.fillColor('#7a6b6e').text(line.caption, left, lineY + 2, { lineBreak: false });
    }
    afterBoxes = checkboxRow(doc, left + layout.captionWidth, lineY, line.labels);
    lineY += CHECKBOX_LINE_HEIGHT;
  }

  const commentY = lineY - CHECKBOX_LINE_HEIGHT;
  doc.fillColor('#7a6b6e').text(COMMENT_CAPTION, afterBoxes + 4, commentY + 2, {
    lineBreak: false,
  });
  const ruleStart = afterBoxes + 4 + doc.widthOfString(COMMENT_CAPTION) + 6;
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

export interface RepProgrammeRow {
  readonly position: number;
  readonly fullName: string;
  readonly phoneE164: string;
}

export interface RepProgrammeData {
  readonly campaignName: string;
  readonly commercialName: string;
  readonly segmentLabel: string;
  readonly generatedAt: Date;
  readonly rows: readonly RepProgrammeRow[];
  readonly dayNumber?: number;
  readonly dayCount?: number;
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

    const bounds = columnBounds(doc.page.width);
    const resultLeft =
      (bounds.find((bound) => bound.column.key === 'result')?.left ?? MARGIN) + TEXT_PAD;
    const layout = layoutResultCell(
      doc,
      data.checkboxGroups,
      doc.page.width - MARGIN - TEXT_PAD - resultLeft,
    );
    const rowHeight = Math.max(ROW_HEIGHT, layout.height);

    const bottom = doc.page.height - MARGIN - FOOTER_SPACE;
    const firstTop = MARGIN + BAND_HEIGHT + BAND_GAP;

    const firstCapacity = capacity(bottom, firstTop, rowHeight);
    const otherCapacity = capacity(bottom, MARGIN, rowHeight);
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
      drawRow(doc, y, row, index, layout, rowHeight);
      y += rowHeight;
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

const capacity = (bottom: number, top: number, rowHeight: number): number =>
  Math.max(1, Math.floor((bottom - top - COLUMN_HEADER_HEIGHT) / rowHeight));

const REP_ROWS_PER_PAGE = 25;
const REP_ROW_HEIGHT = 25;
const REP_HEADER_TOP = 92;
const REP_NAME_LEFT = MARGIN + 42;
const REP_PHONE_LEFT = 410;

function drawRepHeader(doc: Doc, data: RepProgrammeData): void {
  const width = doc.page.width;
  doc.rect(0, 0, width, 80).fill(CPI_BURGUNDY);

  let textLeft = MARGIN;
  const logo = cpiLogo();
  if (logo) {
    doc.image(logo, MARGIN, 15, { height: 40 });
    textLeft = 150;
  }

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff');
  doc.text('Programme représentants', textLeft, 16, {
    width: width - textLeft - MARGIN,
    height: 22,
    ellipsis: true,
  });

  const day =
    data.dayNumber === undefined || data.dayCount === undefined
      ? ''
      : ` · Jour ${String(data.dayNumber)} sur ${String(data.dayCount)}`;
  doc.font('Helvetica').fontSize(10).fillColor('#f3e4e7');
  doc.text(`${data.campaignName} · ${data.commercialName}${day}`, textLeft, 43, {
    width: width - textLeft - MARGIN,
    height: 13,
    ellipsis: true,
  });
  doc.text(data.segmentLabel, textLeft, 58, {
    width: width - textLeft - MARGIN,
    height: 13,
    ellipsis: true,
  });
}

function drawRepColumns(doc: Doc): void {
  const right = doc.page.width - MARGIN;
  doc.rect(MARGIN, REP_HEADER_TOP, right - MARGIN, 24).fill('#ede7e8');
  doc.font('Helvetica-Bold').fontSize(10).fillColor(CPI_BURGUNDY);
  doc.text('N°', MARGIN + TEXT_PAD, REP_HEADER_TOP + 7, { lineBreak: false });
  doc.text('Nom et prénom', REP_NAME_LEFT + TEXT_PAD, REP_HEADER_TOP + 7, {
    lineBreak: false,
  });
  doc.text('Téléphone', REP_PHONE_LEFT + TEXT_PAD, REP_HEADER_TOP + 7, {
    lineBreak: false,
  });
}

function drawRepRow(doc: Doc, row: RepProgrammeRow, index: number): void {
  const y = REP_HEADER_TOP + 24 + index * REP_ROW_HEIGHT;
  const right = doc.page.width - MARGIN;
  if (index % 2 === 1) doc.rect(MARGIN, y, right - MARGIN, REP_ROW_HEIGHT).fill(CPI_ZEBRA);

  doc.lineWidth(0.5).strokeColor(CPI_RULE_GREY);
  for (const x of [MARGIN, REP_NAME_LEFT, REP_PHONE_LEFT, right]) {
    doc
      .moveTo(x, y)
      .lineTo(x, y + REP_ROW_HEIGHT)
      .stroke();
  }
  doc
    .moveTo(MARGIN, y + REP_ROW_HEIGHT)
    .lineTo(right, y + REP_ROW_HEIGHT)
    .stroke();

  doc.font('Helvetica').fontSize(10.5).fillColor('#111111');
  doc.text(String(row.position), MARGIN + TEXT_PAD, y + 7, { lineBreak: false });
  doc.text(row.fullName, REP_NAME_LEFT + TEXT_PAD, y + 7, {
    width: REP_PHONE_LEFT - REP_NAME_LEFT - 2 * TEXT_PAD,
    height: 13,
    ellipsis: true,
  });
  doc.text(
    row.phoneE164.replace(/^(\+221)(\d{2})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5'),
    REP_PHONE_LEFT + TEXT_PAD,
    y + 7,
    {
      width: right - REP_PHONE_LEFT - 2 * TEXT_PAD,
      height: 13,
      ellipsis: true,
    },
  );
}

export function writeRepProgrammePdf(
  out: Writable,
  data: RepProgrammeData,
  options: ProgrammePdfOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margin: MARGIN,
      compress: options.compress ?? true,
      info: {
        Title: `Programme représentants : ${data.campaignName} / ${data.commercialName}`,
        Author: 'CRM Prospection CPI',
        CreationDate: data.generatedAt,
      },
    });
    const pageCount = Math.max(1, Math.ceil(data.rows.length / REP_ROWS_PER_PAGE));

    doc.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    doc.pipe(out);

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      if (pageIndex > 0) doc.addPage();
      drawRepHeader(doc, data);
      drawRepColumns(doc);

      const pageRows = data.rows.slice(
        pageIndex * REP_ROWS_PER_PAGE,
        (pageIndex + 1) * REP_ROWS_PER_PAGE,
      );
      for (const [rowIndex, row] of pageRows.entries()) drawRepRow(doc, row, rowIndex);

      if (pageRows.length === 0) {
        doc
          .font('Helvetica-Oblique')
          .fontSize(12)
          .fillColor('#7a6b6e')
          .text('Aucun représentant affecté.', MARGIN + TEXT_PAD, REP_HEADER_TOP + 42, {
            lineBreak: false,
          });
      }

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#8a8a8a')
        .text(
          `Page ${String(pageIndex + 1)} / ${String(pageCount)}`,
          MARGIN,
          doc.page.height - 36,
          { lineBreak: false },
        );
    }

    doc.end();
  });
}
