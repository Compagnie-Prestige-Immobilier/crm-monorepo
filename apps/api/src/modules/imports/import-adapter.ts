import type { ImportKind, ImportMode, Prisma } from '@crm/database';

import type { ImportColumn } from '../representants/import-template.js';

export type PrismaTransactionClient = Prisma.TransactionClient;

export type { ImportColumn };

export interface ImportRowError {
  rowNumber: number;
  column?: string;
  code: string;
  message: string;
}

export type ParsedRow<T> = { ok: true; row: T } | { ok: false; error: ImportRowError };

export const importCell = (cells: Record<string, string>, column: string): string =>
  cells[column]?.trim() ?? '';

export const unresolvedImportValue = (raw: string, value: unknown): boolean =>
  raw !== '' && value === null;

export interface ChunkOutcome {
  created: number;
  skipped: number;
  errors: readonly ImportRowError[];
  /**
   * Lignes RÉÉCRITES, optionnel : les trois autres adaptateurs ne peuvent
   * structurellement pas corriger une fiche existante, leur faire écrire
   * `updated: 0` laisserait croire qu'ils le pourraient.
   */
  updated?: number;
}

/**
 * Un adaptateur refuse le TRAVAIL entier, pas une ligne : plafond métier
 * dépassé, fichier incohérent avec ce que l'application attend. Distinct
 * d'`ImportRowError`, qui refuse une ligne et laisse les autres continuer.
 */
export class ImportAdapterFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ImportAdapterFailure';
  }
}

export interface ImportRunContext {
  readonly jobId: string;
  readonly mode: ImportMode;
  readonly requestedById: string;
  readonly tx: PrismaTransactionClient;
}

/**
 * Où lire, dans un classeur qui n'a pas été engendré par le produit.
 *
 * Un modèle téléchargé porte ses données sur la première feuille, à partir de
 * `FIRST_DATA_ROW`, colonnes dans l'ordre du modèle. Un classeur tenu à la main
 * ne suit aucune de ces règles, et l'adaptateur est le seul à savoir laquelle il
 * vient reprendre.
 */
export interface SheetLayout {
  /** Feuilles à lire. Les autres sont traversées sans être projetées. */
  readonly sheetPattern: RegExp;
  /**
   * Ligne d'en-tête, numérotée comme Excel l'affiche ; les données suivent.
   * C'est elle qui donne la position de chaque colonne, onglet par onglet.
   */
  readonly headerRow: number;
}

/**
 * Un adaptateur est un SINGLETON Nest, son exécution ne l'est pas.
 *
 * `prepare` rend tout ce que l'exécution mémorise — référentiels chargés,
 * numéros déjà vus — et le moteur le repasse aux deux autres méthodes. Rangé
 * dans un champ d'instance, cet état serait écrasé par le `prepare` du travail
 * suivant PENDANT que le premier lit encore, et des lignes valides seraient
 * refusées.
 */
export interface ImportAdapter<TRow, TRun = unknown> {
  readonly kind: ImportKind;
  readonly maxRows: number;
  readonly templateColumns: readonly ImportColumn[];
  /** Absent : première feuille, `FIRST_DATA_ROW`, colonnes par position. */
  readonly layout?: SheetLayout;
  parseRow(cells: Record<string, string>, rowNumber: number, run: TRun): ParsedRow<TRow>;
  prepare(ctx: ImportRunContext): Promise<TRun>;
  writeChunk(rows: readonly TRow[], ctx: ImportRunContext, run: TRun): Promise<ChunkOutcome>;
}

export const IMPORT_ADAPTERS = Symbol('IMPORT_ADAPTERS');
