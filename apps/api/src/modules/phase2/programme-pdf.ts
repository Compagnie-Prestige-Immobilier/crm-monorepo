import type { Writable } from 'node:stream';

import PDFDocument from 'pdfkit';

/**
 * Programme d'appels papier d'un commercial.
 *
 * ─── AUCUN NOM DE PROSPECT N'APPARAÎT SUR CE DOCUMENT ───────────────────────
 *
 * Ce n'est pas une préférence de mise en page, c'est la raison d'être du format.
 * Une liasse imprimée circule : elle traîne sur un bureau, se photographie, se
 * perd dans un taxi. Un numéro seul est déjà une donnée personnelle, mais un
 * numéro ACCOMPAGNÉ DU NOM constitue un fichier nominatif exploitable tel quel
 * par quiconque le ramasse. Le commercial n'a besoin que d'appeler ; le nom ne
 * lui sert à rien pour composer.
 *
 * Le rapprochement entre la ligne papier et la fiche écran se fait par le
 * couple (numéro d'ordre, code court) — voir `common/short-code.ts`. Un test
 * extrait le texte du PDF produit et vérifie qu'aucun nom en base n'y figure :
 * la règle est vérifiée, pas seulement écrite.
 *
 * ─── Pourquoi pdfkit et pas un moteur de rendu HTML ─────────────────────────
 *
 * Un rendu HTML → PDF suppose un Chromium sans interface : ~300 Mo d'image,
 * un bac à sable à configurer, un processus qui peut rester bloqué, et une
 * empreinte mémoire par requête sans rapport avec la taille du document.
 * pdfkit écrit directement dans un flux Node : la première page part avant que
 * la dernière ne soit calculée, et une campagne de 500 lignes ne fait jamais
 * grossir la mémoire du serveur.
 */

/** Une ligne du programme. Volontairement dépourvue de toute identité nominale. */
export interface ProgrammeRow {
  /** Rang persisté dans `CallTask.position`. L'ordre du PDF est exactement celui-là. */
  readonly position: number;
  /** Code court dérivé de l'identifiant du prospect. */
  readonly shortCode: string;
  readonly phoneE164: string;
}

export interface ProgrammeData {
  readonly campaignName: string;
  readonly commercialName: string;
  /** Libellé du segment, issu de `SEGMENT_LABELS` — jamais recalculé ici. */
  readonly segmentLabel: string;
  readonly generatedAt: Date;
  readonly rows: readonly ProgrammeRow[];
}

/** Les trois méthodes d'enrôlement, dans l'ordre du formulaire terrain. */
const METHOD_LABELS = ['Plateforme', 'Physique', 'Voix ou messagerie électronique'] as const;

/** Les cinq autres issues possibles d'un appel. */
const OTHER_OUTCOME_LABELS = ['Injoignable', 'Rappeler', 'Refus', 'Faux numéro', 'Autre'] as const;

const MARGIN = 28;
const ROW_HEIGHT = 30;
const LINE_GAP = 13;
const BOX_SIZE = 8;
const BOX_LABEL_GAP = 3;
const CHECKBOX_GAP = 9;

const COLUMN_ORDER = MARGIN;
const COLUMN_CODE = MARGIN + 30;
const COLUMN_PHONE = MARGIN + 88;
const COLUMN_BOXES = MARGIN + 196;

/**
 * Horodatage d'édition, en heure de Dakar.
 *
 * Le fuseau est FIXÉ, pas déduit du serveur : l'API peut tourner sur une
 * machine en UTC, et un programme daté « 23h47 la veille » ferait douter le
 * commercial de la fraîcheur de sa liste.
 */
export function formatDakar(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Dakar',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

/** Nom de fichier proposé au téléchargement. */
export function programmeFilename(data: Pick<ProgrammeData, 'generatedAt'>): string {
  return `programme-appels-${data.generatedAt.toISOString().slice(0, 10)}.pdf`;
}

type Doc = InstanceType<typeof PDFDocument>;

/** Case à cocher suivie de son libellé. Renvoie la largeur totale consommée. */
function checkbox(doc: Doc, x: number, y: number, label: string): number {
  doc.lineWidth(0.6).rect(x, y, BOX_SIZE, BOX_SIZE).stroke('#333333');
  const textX = x + BOX_SIZE + BOX_LABEL_GAP;
  doc.fillColor('#000000').text(label, textX, y + 0.5, { lineBreak: false });
  return BOX_SIZE + BOX_LABEL_GAP + doc.widthOfString(label);
}

function checkboxRow(doc: Doc, x: number, y: number, labels: readonly string[]): number {
  let cursor = x;
  for (const label of labels) {
    cursor += checkbox(doc, cursor, y, label) + CHECKBOX_GAP;
  }
  return cursor;
}

/** En-tête de première page. Renvoie l'ordonnée de la première ligne. */
function drawHeader(doc: Doc, data: ProgrammeData): number {
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#000000');
  doc.text(data.campaignName, MARGIN, MARGIN, { lineBreak: false });

  doc.font('Helvetica').fontSize(9.5).fillColor('#333333');
  const line = MARGIN + 22;
  doc.text(`Commercial : ${data.commercialName}`, MARGIN, line, { lineBreak: false });
  doc.text(`Base : ${data.segmentLabel}`, MARGIN + 260, line, { lineBreak: false });
  doc.text(`Total : ${String(data.rows.length)} lignes`, MARGIN + 620, line, { lineBreak: false });

  const line2 = line + 13;
  doc.text(`Édité le ${formatDakar(data.generatedAt)} (heure de Dakar)`, MARGIN, line2, {
    lineBreak: false,
  });
  doc
    .fillColor('#777777')
    .text(
      'Document sans nom : chaque ligne se rapproche de sa fiche par son code.',
      MARGIN + 260,
      line2,
      { lineBreak: false },
    );

  return line2 + 20;
}

/** Bandeau de colonnes, répété sur chaque page. Renvoie l'ordonnée de la première ligne. */
function drawColumnHeader(doc: Doc, y: number): number {
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#555555');
  doc.text('N°', COLUMN_ORDER, y, { lineBreak: false });
  doc.text('Code', COLUMN_CODE, y, { lineBreak: false });
  doc.text('Téléphone', COLUMN_PHONE, y, { lineBreak: false });
  doc.text('Résultat de l’appel — cocher une seule case', COLUMN_BOXES, y, { lineBreak: false });

  const rule = y + 11;
  doc
    .lineWidth(0.8)
    .moveTo(MARGIN, rule)
    .lineTo(doc.page.width - MARGIN, rule)
    .stroke('#555555');
  return rule + 7;
}

function drawRow(doc: Doc, y: number, row: ProgrammeRow, right: number): void {
  doc.font('Helvetica').fontSize(9).fillColor('#000000');
  doc.text(String(row.position), COLUMN_ORDER, y, { lineBreak: false });
  doc.font('Helvetica-Bold').text(row.shortCode, COLUMN_CODE, y, { lineBreak: false });
  doc.font('Helvetica').fontSize(10).text(row.phoneE164, COLUMN_PHONE, y, { lineBreak: false });

  doc.fontSize(8);
  doc.fillColor('#555555').text('Méthode', COLUMN_BOXES, y + 1, { lineBreak: false });
  checkboxRow(doc, COLUMN_BOXES + 44, y, METHOD_LABELS);

  const second = y + LINE_GAP;
  doc.fillColor('#555555').text('Autre', COLUMN_BOXES, second + 1, { lineBreak: false });
  const afterBoxes = checkboxRow(doc, COLUMN_BOXES + 44, second, OTHER_OUTCOME_LABELS);

  doc.fillColor('#555555').text('Commentaire', afterBoxes + 6, second + 1, { lineBreak: false });
  const commentStart = afterBoxes + 6 + doc.widthOfString('Commentaire') + 5;
  doc
    .lineWidth(0.4)
    .moveTo(commentStart, second + BOX_SIZE + 1)
    .lineTo(right, second + BOX_SIZE + 1)
    .stroke('#999999');

  doc
    .lineWidth(0.3)
    .moveTo(MARGIN, y + ROW_HEIGHT - 5)
    .lineTo(right, y + ROW_HEIGHT - 5)
    .stroke('#dddddd');
}

export interface ProgrammePdfOptions {
  /**
   * Compression des flux. Vraie en production. Les tests la désactivent quand
   * ils veulent lire le contenu sans décompresser.
   */
  readonly compress?: boolean;
}

/**
 * Écrit le programme dans `out` et résout quand le flux a tout absorbé.
 *
 * `out` est le flux HTTP brut : rien n'est tamponné en mémoire. En cas d'échec
 * en cours d'écriture, l'appelant coupe la connexion — un PDF tronqué qui
 * s'ouvrirait comme s'il était complet serait pire qu'un téléchargement échoué.
 */
export function writeProgrammePdf(
  out: Writable,
  data: ProgrammeData,
  options: ProgrammePdfOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      // Paysage : une ligne porte un numéro, un code, un téléphone, huit cases
      // et une zone de commentaire. En portrait, tout cela se replie sur trois
      // lignes et la liasse triple d'épaisseur.
      layout: 'landscape',
      margin: MARGIN,
      compress: options.compress ?? true,
      info: {
        Title: `${data.campaignName} — ${data.commercialName}`,
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

    const right = doc.page.width - MARGIN;
    const bottom = doc.page.height - MARGIN - 14;

    let y = drawColumnHeader(doc, drawHeader(doc, data));
    let pageNumber = 1;

    const footer = (): void => {
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#999999')
        .text(`Page ${String(pageNumber)}`, MARGIN, doc.page.height - MARGIN - 8, {
          lineBreak: false,
        });
    };

    for (const row of data.rows) {
      if (y + ROW_HEIGHT > bottom) {
        footer();
        doc.addPage();
        pageNumber += 1;
        y = drawColumnHeader(doc, MARGIN);
      }
      drawRow(doc, y, row, right);
      y += ROW_HEIGHT;
    }

    if (data.rows.length === 0) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(10)
        .fillColor('#777777')
        .text('Aucune ligne affectée à ce commercial.', MARGIN, y, { lineBreak: false });
    }

    footer();
    doc.end();
  });
}
