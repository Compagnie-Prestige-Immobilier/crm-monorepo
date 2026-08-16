import { createReadStream } from 'node:fs';
import ExcelJS from 'exceljs';

import type { ImportColumn } from './import-adapter.js';
import { FIRST_DATA_ROW } from './imports.job.js';

/**
 * Lecture d'un classeur EN FLUX.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * C'EST LE SEUL VRAI CHANGEMENT DE CODE DE TOUT LE CHANTIER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'import synchrone appelait `workbook.xlsx.load(buffer)`, qui DÉPLOIE le
 * classeur entier en objets JavaScript avant de rendre la main. Un `.xlsx` est
 * un ZIP : cinquante mille lignes tiennent dans quelques mégaoctets sur le
 * disque et pèsent plusieurs centaines de mégaoctets une fois déployées,
 * cellule par cellule, chacune étant un objet. Le plafond de 5 000 lignes
 * n'était pas une règle métier, c'était la limite au-delà de laquelle le
 * conteneur mourait — et il mourait AVANT que le contrôle du plafond n'ait eu
 * la moindre chance de s'exécuter.
 *
 * `stream.xlsx.WorkbookReader` lit le même fichier ligne par ligne : la mémoire
 * occupée ne dépend plus du nombre de lignes, mais de la taille d'UNE ligne.
 * C'est ce qui autorise à porter le plafond à cinquante mille sans rien changer
 * d'autre.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * INJECTÉ PAR JETON, comme `BREVO_TRANSPORT`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lire un fichier est un effet. Le moteur ne doit pas dépendre d'un disque pour
 * être exerçable : les tests fournissent une source de lignes en mémoire, et
 * tout le reste (tranches, transactions, bail, reprise, plafond) est éprouvé
 * pour de vrai. Il n'y a PAS d'objet nul ici, et c'est délibéré : un import sans
 * lecteur n'a pas de mode dégradé, il n'a pas lieu.
 */

/** Une ligne du classeur, telle que le moteur la transmet à l'adaptateur. */
export interface SheetRow {
  /** Numéro DANS LE FICHIER, en-tête compris : ce que la personne lit dans Excel. */
  readonly rowNumber: number;
  /**
   * Les cellules, indexées par l'EN-TÊTE DU MODÈLE.
   *
   * La clé vient du modèle, jamais de la ligne d'en-tête du fichier : le
   * rapprochement se fait par POSITION, comme le dit `import-template.ts`, parce
   * qu'un utilisateur renomme une colonne bien plus souvent qu'il n'en déplace
   * une. La clé lisible n'est qu'un confort d'écriture pour l'adaptateur.
   */
  readonly cells: Record<string, string>;
}

/** Une feuille ouverte, dont les lignes se tirent une par une. */
export interface SheetSource {
  /**
   * Nombre de lignes de DONNÉES annoncé par l'en-tête de la feuille, ou `null`.
   *
   * `null` est le cas ORDINAIRE, pas l'exception : l'élément `<dimension>` est
   * facultatif dans le format, et la plupart des tableurs tiers ne l'écrivent
   * pas en réenregistrant un fichier. Le plafond ne peut donc pas reposer sur
   * lui seul — il est doublé d'un compteur pendant la lecture. Quand il est
   * présent, il permet de refuser un classeur de deux millions de lignes SANS
   * en avoir lu une seule.
   */
  readonly declaredDataRows: number | null;
  rows(): AsyncIterable<SheetRow>;
  close(): Promise<void>;
}

export interface ImportRowReader {
  /** Ouvre la PREMIÈRE feuille du classeur. Lève si le fichier est illisible. */
  open(storagePath: string, columns: readonly ImportColumn[]): Promise<SheetSource>;
}

export const IMPORT_ROW_READER = Symbol('IMPORT_ROW_READER');

/** Le classeur n'est pas lisible : ni `.xlsx`, ni feuille exploitable. */
export class UnreadableWorkbookError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'UnreadableWorkbookError';
  }
}

/** Texte d'une cellule, quel que soit son type. Une formule rend son résultat. */
export function cellText(value: ExcelJS.CellValue): string {
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

/**
 * Une ligne entièrement vide est IGNORÉE, jamais rejetée.
 *
 * Un classeur rempli à la main en porte toujours quelques-unes en fin de
 * fichier, et les compter en erreur ferait paraître l'import cassé alors qu'il
 * a tout lu correctement.
 */
export const isBlankRow = (cells: Record<string, string>): boolean =>
  Object.values(cells).every((cell) => cell === '');

export class ExcelStreamRowReader implements ImportRowReader {
  async open(storagePath: string, columns: readonly ImportColumn[]): Promise<SheetSource> {
    const file = createReadStream(storagePath);
    const workbook = new ExcelJS.stream.xlsx.WorkbookReader(file, {
      worksheets: 'emit',
      // Les chaînes partagées sont CACHÉES et non émises : c'est la seule
      // structure du format dont la taille suit le nombre de lignes. La cacher
      // est le prix à payer pour que `row.getCell().value` rende du texte plutôt
      // qu'un index ; elle reste un ordre de grandeur en dessous du classeur
      // déployé.
      sharedStrings: 'cache',
      styles: 'ignore',
      hyperlinks: 'ignore',
      entries: 'ignore',
    });

    const worksheets = workbook[Symbol.asyncIterator]();
    let first;
    try {
      first = await worksheets.next();
    } catch (error) {
      file.destroy();
      throw new UnreadableWorkbookError(
        `Le fichier n’est pas un classeur Excel lisible (.xlsx). ${String(error)}`,
      );
    }

    if (first.done === true) {
      file.destroy();
      throw new UnreadableWorkbookError('Le classeur ne contient aucune feuille.');
    }

    // La PREMIÈRE feuille, jamais celle qui porte un nom attendu : le modèle
    // fourni est souvent réenregistré depuis un autre tableur, qui renomme la
    // feuille au passage. Chercher « Représentants » ferait échouer un fichier
    // parfaitement valide.
    const sheet = first.value;

    // `dimensions` est déclaré comme une méthode par les typages d'exceljs et
    // se comporte comme une propriété à l'exécution. On le lit donc de façon
    // DÉFENSIVE : absent, illisible ou d'une autre forme, il vaut « inconnu »,
    // et le compteur de lecture reste seul juge du plafond.
    const declared = (sheet as unknown as { dimensions?: { bottom?: number } | null }).dimensions;
    const bottom = typeof declared?.bottom === 'number' ? declared.bottom : null;
    const declaredDataRows =
      bottom !== null && bottom >= FIRST_DATA_ROW ? bottom - FIRST_DATA_ROW + 1 : null;

    return {
      declaredDataRows,
      rows: () => readRows(sheet, columns),
      close: async () => {
        // On ferme la source AVANT de rendre la main : sans cela, un refus au
        // plafond laisserait un descripteur de fichier ouvert par import refusé,
        // et le conteneur finirait par ne plus pouvoir en ouvrir un seul.
        file.destroy();
        await worksheets.return(undefined);
      },
    };
  }
}

async function* readRows(
  sheet: ExcelJS.stream.xlsx.WorksheetReader,
  columns: readonly ImportColumn[],
): AsyncIterable<SheetRow> {
  for await (const row of sheet) {
    const rowNumber = row.number;
    if (rowNumber < FIRST_DATA_ROW) continue;

    const cells: Record<string, string> = {};
    columns.forEach((column, index) => {
      cells[column.header] = cellText(row.getCell(index + 1).value);
    });

    yield { rowNumber, cells };
  }
}
