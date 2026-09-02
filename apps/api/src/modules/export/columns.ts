import { classifySegment } from '@crm/database';
import type { Prisma } from '@crm/database';

import {
  CALL_OUTCOME_LABELS,
  ENROLLMENT_METHOD_LABELS,
  MODE_EPARGNE_LABELS,
  PHASE2_STATUS_LABELS,
  PROJET_LABELS,
  PROSPECT_STATUT_LABELS,
  PROSPECT_TYPE_LABELS,
  TYPE_CONTRAT_LABELS,
} from '../prospects/phase2-labels.js';
import type { LastAttempt } from '../prospects/last-attempt.js';
import { toDakarCell } from './dakar.js';

export const EXPORT_INCLUDE = {
  banque: { select: { name: true, shortName: true } },
  syndicat: { select: { sigle: true, name: true } },
  canalProvenance: { select: { label: true } },
  professionRef: { select: { label: true } },
  employeurRef: { select: { label: true } },
  paysResidence: { select: { label: true } },
  journeys: { select: { projet: true, statut: true }, orderBy: { createdAt: 'asc' } },
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

/** Une cellule vide vaut la chaine vide : `null` s'ecrirait « null » dans le tableur. */
export type CellValue = string | number | Date;

export interface ColumnSpec {
  header: string;
  key: string;
  /** Recoit le format d'affichage date et l'heure de Dakar. */
  isDate?: boolean;
  value: (row: ExportRow, last: LastAttempt | undefined) => CellValue;
}

// Liste partagee par les deux modes : l'onglet BDD1 et l'export filtre sur BDD1 ne peuvent
// pas differer de colonnes ni d'ordre.
export const PROSPECT_COLUMNS: readonly ColumnSpec[] = [
  { header: 'Nom', key: 'nom', value: (row) => row.nom },
  { header: 'Prénom', key: 'prenom', value: (row) => row.prenom },
  { header: 'Téléphone', key: 'phone', value: (row) => row.phoneE164 },
  // Les parcours, pas la colonne `projet` : celle-ci ne dit que par où la fiche
  // est ENTRÉE, et un prospect peut suivre les deux projets à la fois.
  {
    header: 'Projets',
    key: 'projets',
    value: (row) => row.journeys.map((j) => PROJET_LABELS[j.projet]).join(' + '),
  },
  {
    header: 'Statut',
    key: 'statut',
    // Le statut de CHAQUE parcours : la feuille Synthèse compte des convertis
    // qu'aucune colonne ne permettait de retrouver ligne à ligne.
    value: (row) =>
      row.journeys
        .map((j) => `${PROJET_LABELS[j.projet]} : ${PROSPECT_STATUT_LABELS[j.statut]}`)
        .join(' · '),
  },
  { header: 'Banque', key: 'banque', value: (row) => row.banque?.name ?? '' },
  { header: 'Syndicat', key: 'syndicat', value: (row) => row.syndicat?.sigle ?? '' },
  { header: 'Représentant', key: 'representant', value: (row) => row.representant?.fullName ?? '' },
  {
    header: 'Tél. représentant',
    key: 'representantPhone',
    value: (row) => row.representant?.phoneE164 ?? '',
  },
  {
    header: 'Département',
    key: 'departement',
    value: (row) => row.representant?.departement.name ?? '',
  },
  { header: 'Commercial', key: 'commercial', value: (row) => row.createdBy.fullName },
  { header: 'Date de saisie', key: 'saisie', isDate: true, value: (row) => row.clientCreatedAt },

  // Colonnes du Grand Public. Sans elles, une fiche GP sortait avec six
  // colonnes vides d'affilée et AUCUNE de ses propres données : rien ne la
  // distinguait d'une fiche CHUES incomplète.
  {
    header: 'Secteur',
    key: 'type',
    value: (row) => (row.type ? PROSPECT_TYPE_LABELS[row.type] : ''),
  },
  {
    header: 'Profession',
    key: 'profession',
    value: (row) => row.professionRef?.label ?? row.profession ?? '',
  },
  {
    header: 'Canal de provenance',
    key: 'canalProvenance',
    value: (row) => row.canalProvenance?.label ?? '',
  },
  {
    header: 'Durée du système (mois)',
    key: 'dureeSystemeMois',
    value: (row) => row.dureeSystemeMois ?? '',
  },
  {
    header: 'Employeur',
    key: 'employeur',
    value: (row) => row.employeurRef?.label ?? row.employeur ?? '',
  },
  {
    header: 'Type de contrat',
    key: 'typeContrat',
    value: (row) => (row.typeContrat ? TYPE_CONTRAT_LABELS[row.typeContrat] : ''),
  },
  {
    header: 'Ancienneté (mois)',
    key: 'ancienneteMois',
    value: (row) => row.ancienneteMois ?? '',
  },
  { header: 'Lieu d’activité', key: 'lieuActivite', value: (row) => row.lieuActivite ?? '' },
  {
    header: 'Mode d’épargne',
    key: 'modeEpargne',
    value: (row) => (row.modeEpargne ? MODE_EPARGNE_LABELS[row.modeEpargne] : ''),
  },
  {
    header: 'Pays de résidence',
    key: 'paysResidence',
    value: (row) => row.paysResidence?.label ?? '',
  },
  { header: 'Ville de résidence', key: 'villeResidence', value: (row) => row.villeResidence ?? '' },
  { header: 'WhatsApp', key: 'whatsappE164', value: (row) => row.whatsappE164 ?? '' },
  { header: 'Relais au Sénégal', key: 'relaisNom', value: (row) => row.relaisNom ?? '' },
  { header: 'Tél. relais', key: 'relaisPhoneE164', value: (row) => row.relaisPhoneE164 ?? '' },

  {
    header: 'Segment',
    key: 'segment',
    // Recalcule ligne a ligne par le helper partage, jamais lu en colonne : c'est ce qui garantit
    // que l'onglet « BDD1 » du classeur consolide contient la population du graphique « BDD1 ».
    value: (row) =>
      classifySegment({
        syndicatSigle: row.syndicat?.sigle ?? null,
        banqueShortName: row.banque?.shortName ?? null,
      }) ?? '',
  },
  {
    header: 'Méthode d’enrôlement',
    key: 'enrollmentMethod',
    value: (row) => (row.enrollmentMethod ? ENROLLMENT_METHOD_LABELS[row.enrollmentMethod] : ''),
  },
  {
    header: 'Statut phase 3 (conversion)',
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

export function cellValue(
  column: ColumnSpec,
  row: ExportRow,
  last: LastAttempt | undefined,
): CellValue {
  const value = column.value(row, last);
  return value instanceof Date ? toDakarCell(value) : value;
}
