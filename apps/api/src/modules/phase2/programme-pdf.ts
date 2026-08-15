import type { Writable } from 'node:stream';

import PDFDocument from 'pdfkit';

import { CPI_BURGUNDY, CPI_RULE_GREY, CPI_ZEBRA, cpiLogo } from '../../common/brand.js';

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
 * couple (numéro d'ordre, code court), voir `common/short-code.ts`. Un test
 * extrait le texte du PDF produit et vérifie qu'aucun nom en base n'y figure :
 * la règle est vérifiée, pas seulement écrite.
 *
 * ─── C'EST LE SEUL DOCUMENT QUE CPI REMET À L'EXTÉRIEUR ─────────────────────
 *
 * Il est imprimé et posé sur la table d'un commercial, parfois devant un
 * partenaire. La mise en page n'est donc pas une coquetterie : logo, bandeau
 * bordeaux, vraie grille de tableau et corps lisible sans se pencher. Ce qui a
 * été délibérément ÉCARTÉ : toute mention de confidentialité. Une liasse
 * estampillée « confidentiel » circule exactement comme les autres, et la seule
 * garantie réelle est ailleurs, dans l'absence de noms.
 *
 * ─── Pourquoi pdfkit et pas un moteur de rendu HTML ─────────────────────────
 *
 * Un rendu HTML vers PDF suppose un Chromium sans interface : ~300 Mo d'image,
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

/** Une rangée de cases à cocher, précédée de son intitulé. */
export interface CheckboxGroup {
  readonly caption: string;
  readonly options: readonly string[];
}

export interface ProgrammeData {
  readonly campaignName: string;
  readonly commercialName: string;
  /** Libellé du segment, issu de `SEGMENT_LABELS`, jamais recalculé ici. */
  readonly segmentLabel: string;
  readonly generatedAt: Date;
  readonly rows: readonly ProgrammeRow[];
  /**
   * Journée d'étalement affichée, à partir de 1. Absente : le programme couvre
   * toute la campagne, exactement comme avant l'arrivée de l'étalement.
   */
  readonly dayNumber?: number;
  /** Nombre total de journées de la campagne. Sans objet si `dayNumber` est absent. */
  readonly dayCount?: number;

  /**
   * Titre du bandeau. Par défaut le programme de prospection.
   *
   * Les campagnes d'appels aux REPRÉSENTANTS réemploient ce générateur : même
   * géométrie, même invariant d'anonymat, seules changent les cases à cocher et
   * l'intitulé. Réécrire un second générateur pour trois chaînes ferait diverger
   * deux mises en page qui doivent rester identiques, puisque le même commercial
   * reçoit les deux liasses le même matin.
   */
  readonly title?: string;
  /** Intitulé du périmètre en ligne méta. Par défaut « Base ». */
  readonly scopeCaption?: string;
  /** Rangées de cases. Par défaut : méthodes d'enrôlement, puis autres issues. */
  readonly checkboxGroups?: readonly CheckboxGroup[];
}

/** Les trois méthodes d'enrôlement, dans l'ordre du formulaire terrain. */
const METHOD_LABELS = ['Plateforme', 'Physique', 'Voix ou messagerie électronique'] as const;

/** Les cinq autres issues possibles d'un appel. */
const OTHER_OUTCOME_LABELS = ['Injoignable', 'Rappeler', 'Refus', 'Faux numéro', 'Autre'] as const;

/** Cases du programme de prospection : ce que le terrain remplit depuis toujours. */
export const PROSPECT_CHECKBOX_GROUPS: readonly CheckboxGroup[] = [
  { caption: 'Méthode', options: METHOD_LABELS },
  { caption: 'Autre', options: OTHER_OUTCOME_LABELS },
];

// ─────────────────────────────────────────────────────────────────────────────
// Géométrie
//
// Toutes les mesures sont en points PostScript. La page est en A4 paysage :
// 841,89 × 595,28. Les valeurs ci-dessous sont calibrées sur un corps de 14,
// qui est la contrainte de départ : c'est la taille à laquelle un numéro se
// compose sans se pencher sur la feuille.
// ─────────────────────────────────────────────────────────────────────────────

const MARGIN = 28;

/** Corps du tableau. C'est LA contrainte : tout le reste s'y adapte. */
const BODY_SIZE = 14;

/** Libellés des cases à cocher. Plus petits que le corps, mais lisibles imprimés. */
const CHECKBOX_SIZE = 9.5;

/** Côté de la case, au ratio du corps 14 (l'ancienne maquette avait 8 pour un corps 9). */
const BOX_SIZE = 12;
const BOX_LABEL_GAP = 4;
const CHECKBOX_GAP = 9;

/** Hauteur d'une ligne : deux rangées de cases plus la zone de commentaire. */
const ROW_HEIGHT = 46;

/** Hauteur du bandeau bordeaux de première page. */
const BAND_HEIGHT = 76;

/** Blanc entre le bandeau et l'en-tête de colonnes. */
const BAND_GAP = 12;

/** Hauteur du bandeau de colonnes, réimprimé sur chaque page. */
const COLUMN_HEADER_HEIGHT = 26;

/** Espace réservé au pied de page. */
const FOOTER_SPACE = 22;

const TEXT_PAD = 7;

interface Column {
  readonly key: 'order' | 'code' | 'phone' | 'result';
  readonly header: string;
  readonly width: number;
}

/**
 * Colonnes du tableau.
 *
 * La colonne « Résultat » prend tout ce qui reste : c'est la seule dont la
 * largeur est contrainte par son contenu (huit cases et une zone de
 * commentaire), les trois autres étant dimensionnées sur des chaînes de
 * longueur connue.
 *
 * Le commentaire n'a délibérément PAS de colonne à lui : il partage la cellule
 * « Résultat », sous la ligne des issues. Une colonne séparée obligerait à
 * réduire encore la zone des cases, qui est la partie réellement remplie sur le
 * terrain.
 */
const COLUMNS: readonly Column[] = [
  { key: 'order', header: 'N°', width: 36 },
  { key: 'code', header: 'Code', width: 78 },
  { key: 'phone', header: 'Téléphone', width: 124 },
  // Largeur réelle calculée à l'ouverture du document, voir `columnBounds`.
  { key: 'result', header: 'Résultat de l’appel, cocher une seule case', width: 0 },
];

/** Bornes gauche et droite de chaque colonne, pour une largeur de page donnée. */
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

/**
 * Nom de fichier proposé au téléchargement.
 *
 * La journée figure dans le nom quand la campagne est étalée : sept programmes
 * téléchargés le même jour se retrouveraient sinon tous appelés
 * « programme-appels-2026-04-08 (3).pdf » dans le dossier de téléchargement,
 * et personne ne saurait lequel imprimer.
 */
export function programmeFilename(
  data: Pick<ProgrammeData, 'generatedAt'> & { readonly dayNumber?: number },
): string {
  const date = data.generatedAt.toISOString().slice(0, 10);
  const day = data.dayNumber === undefined ? '' : `-jour-${String(data.dayNumber)}`;
  return `programme-appels-${date}${day}.pdf`;
}

type Doc = InstanceType<typeof PDFDocument>;

/** Case à cocher suivie de son libellé. Renvoie la largeur totale consommée. */
function checkbox(doc: Doc, x: number, y: number, label: string): number {
  doc.lineWidth(0.8).rect(x, y, BOX_SIZE, BOX_SIZE).stroke('#5a5a5a');
  const textX = x + BOX_SIZE + BOX_LABEL_GAP;
  // Le libellé est centré sur la case, pas aligné sur son bord haut : à corps
  // 14 l'écart se voit, et une rangée de cases décalées se lit comme une faute
  // d'impression.
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

/**
 * Bandeau de première page : logo, titre, ligne méta.
 *
 * Un logo introuvable ne fait PAS échouer le document : le bandeau se contente
 * alors de son titre. Voir `common/brand.ts` : l'image est un fichier de
 * l'arbre source, et un `COPY` oublié dans le fichier de build casserait la
 * production sur le seul document que CPI remet à l'extérieur.
 */
function drawBand(doc: Doc, data: ProgrammeData): void {
  const width = doc.page.width;
  doc.rect(0, 0, width, BAND_HEIGHT + MARGIN).fill(CPI_BURGUNDY);

  let textLeft = MARGIN;
  const logo = cpiLogo();
  if (logo) {
    const logoHeight = 44;
    doc.image(logo, MARGIN, 18, { height: logoHeight });
    // `doc.image` n'expose pas la largeur rendue : on réserve une bande fixe,
    // dimensionnée sur le rapport du fichier fourni. Une réservation trop large
    // décale le titre, ce qui est sans gravité ; un chevauchement, non.
    textLeft = MARGIN + logoHeight * 2.6 + 18;
  }

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff');
  doc.text(data.title ?? 'Programme d’appels', textLeft, 20, { lineBreak: false });

  // Largeur BORNÉE et coupure explicite : un nom de campagne peut aller
  // jusqu'à 120 caractères, et sans cette borne il déborderait hors de la page
  // en emportant la moitié de la ligne méta avec lui.
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

/**
 * Les trois lignes de la ligne méta : ce qui identifie la liasse, ce qui dit
 * si elle est encore bonne à imprimer, et pourquoi elle ne porte aucun nom.
 */
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

/**
 * Abscisses de TOUS les filets verticaux : les séparations de colonnes plus les
 * deux bords du tableau.
 *
 * Les bords extérieurs comptent autant que les intérieurs : sans eux le tableau
 * s'arrête dans le vide à droite, et la zone de commentaire (celle qu'on remplit
 * justement à la main) n'a plus de fin visible.
 */
const verticals = (
  bounds: readonly { readonly left: number }[],
  right: number,
): readonly number[] => [...bounds.map((bound) => bound.left), right];

/** Bandeau de colonnes, répété sur chaque page. Renvoie l'ordonnée de la première ligne. */
function drawColumnHeader(doc: Doc, y: number): number {
  const bounds = columnBounds(doc.page.width);
  const left = MARGIN;
  const right = doc.page.width - MARGIN;

  doc.rect(left, y, right - left, COLUMN_HEADER_HEIGHT).fill('#ede7e8');

  doc.font('Helvetica-Bold').fontSize(10).fillColor(CPI_BURGUNDY);
  for (const bound of bounds) {
    doc.text(bound.column.header, bound.left + TEXT_PAD, y + 8, { lineBreak: false });
  }

  // Filets verticaux du bandeau, puis trait plein sous l'en-tête. Sans eux le
  // bandeau flotte au-dessus d'une grille à laquelle il n'appartient pas.
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

/** Une ligne du tableau, grille comprise. `index` porte l'alternance zébrée. */
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

  // Zébrure d'abord : elle sert de fond, tout le reste s'écrit par-dessus.
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

/**
 * Les cases et la zone de commentaire, dans la cellule « Résultat ».
 *
 * Le commentaire prolonge la DERNIÈRE rangée de cases plutôt que d'occuper une
 * ligne à lui : une troisième ligne ferait passer la hauteur de ligne de 46 à
 * 60 points, soit deux fiches de moins par page imprimée pour une zone qui est
 * remplie une fois sur dix.
 */
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
 * en cours d'écriture, l'appelant coupe la connexion : un PDF tronqué qui
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

    // La pagination est CALCULÉE, pas constatée. « Page 3 / 14 » exige le total
    // avant d'écrire la première page, et le document part en flux : on ne peut
    // pas revenir en arrière. La capacité d'une page ne dépend que de la
    // géométrie, donc elle se déduit, à condition que la boucle d'écriture
    // change de page sur EXACTEMENT le même critère, d'où le compteur de lignes
    // posées plutôt qu'un test sur l'ordonnée courante.
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

/** Nombre de lignes qu'une page accueille entre `top` et `bottom`. Au moins une. */
const capacity = (bottom: number, top: number): number =>
  Math.max(1, Math.floor((bottom - top - COLUMN_HEADER_HEIGHT) / ROW_HEIGHT));
