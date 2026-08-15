import { classifySegment } from '@crm/database';
import type { Prisma } from '@crm/database';

import {
  CALL_OUTCOME_LABELS,
  ENROLLMENT_METHOD_LABELS,
  PHASE2_STATUS_LABELS,
} from '../prospects/phase2-labels.js';
import type { LastAttempt } from '../prospects/last-attempt.js';
import { toDakarCell } from './dakar.js';

/**
 * Colonnes du classeur, définies une seule fois.
 *
 * Les deux modes d'export, vue filtrée et classeur consolidé, partagent cette
 * liste : l'onglet « BDD1 » et l'export filtré sur BDD1 ne peuvent donc pas
 * afficher des colonnes différentes, ni les mêmes colonnes dans un autre ordre.
 */

export const EXPORT_INCLUDE = {
  banque: { select: { name: true, shortName: true } },
  syndicat: { select: { sigle: true, name: true } },
  createdBy: { select: { fullName: true } },
  enrollmentCapturedBy: { select: { fullName: true } },
  representant: {
    select: {
      id: true,
      fullName: true,
      phoneE164: true,
      clientCreatedAt: true,
      departement: { select: { name: true } },
      createdBy: { select: { fullName: true } },
    },
  },
} satisfies Prisma.ProspectInclude;

export type ExportRow = Prisma.ProspectGetPayload<{ include: typeof EXPORT_INCLUDE }>;

/** Une cellule vide vaut la chaîne vide : `null` s'écrirait « null » dans le tableur. */
export type CellValue = string | number | Date;

export interface ColumnSpec {
  header: string;
  key: string;
  /** Les colonnes de date reçoivent le format d'affichage et l'heure de Dakar. */
  isDate?: boolean;
  value: (row: ExportRow, last: LastAttempt | undefined) => CellValue;
}

export const PROSPECT_COLUMNS: readonly ColumnSpec[] = [
  { header: 'Nom', key: 'nom', value: (row) => row.nom },
  { header: 'Prénom', key: 'prenom', value: (row) => row.prenom },
  { header: 'Téléphone', key: 'phone', value: (row) => row.phoneE164 },
  { header: 'Banque', key: 'banque', value: (row) => row.banque.name },
  { header: 'Syndicat', key: 'syndicat', value: (row) => row.syndicat.sigle },
  { header: 'Représentant', key: 'representant', value: (row) => row.representant.fullName },
  {
    header: 'Tél. représentant',
    key: 'representantPhone',
    value: (row) => row.representant.phoneE164,
  },
  { header: 'Département', key: 'departement', value: (row) => row.representant.departement.name },
  { header: 'Commercial', key: 'commercial', value: (row) => row.createdBy.fullName },
  { header: 'Date de saisie', key: 'saisie', isDate: true, value: (row) => row.clientCreatedAt },

  // ── Phase 2 ────────────────────────────────────────────────────────────────
  {
    header: 'Segment',
    key: 'segment',
    // Recalculé ligne à ligne par le helper partagé, jamais lu depuis une
    // colonne : c'est ce qui garantit que l'onglet « BDD1 » du classeur
    // consolidé contient exactement la population du graphique « BDD1 ».
    value: (row) =>
      classifySegment({
        syndicatSigle: row.syndicat.sigle,
        banqueShortName: row.banque.shortName,
      }),
  },
  {
    header: 'Méthode d’enrôlement',
    key: 'enrollmentMethod',
    value: (row) => (row.enrollmentMethod ? ENROLLMENT_METHOD_LABELS[row.enrollmentMethod] : ''),
  },
  {
    header: 'Statut phase 2',
    key: 'phase2Status',
    value: (row) => PHASE2_STATUS_LABELS[row.phase2Status],
  },
  {
    header: 'Dernier résultat',
    key: 'lastOutcome',
    value: (_row, last) => (last ? CALL_OUTCOME_LABELS[last.outcome] : ''),
  },
  {
    header: 'Dernier commentaire',
    key: 'lastComment',
    value: (_row, last) => last?.comment ?? '',
  },
  {
    header: 'Dernier appel',
    key: 'lastAttemptAt',
    isDate: true,
    value: (_row, last) => last?.at ?? '',
  },
  {
    header: 'Méthode obtenue par',
    key: 'capturedBy',
    value: (row) => row.enrollmentCapturedBy?.fullName ?? '',
  },
  {
    header: 'Date d’obtention',
    key: 'capturedAt',
    isDate: true,
    value: (row) => row.enrollmentCapturedAt ?? '',
  },
];

/** Valeur prête pour le tableur : les dates y passent à l'heure de Dakar. */
export function cellValue(
  column: ColumnSpec,
  row: ExportRow,
  last: LastAttempt | undefined,
): CellValue {
  const value = column.value(row, last);
  return value instanceof Date ? toDakarCell(value) : value;
}
