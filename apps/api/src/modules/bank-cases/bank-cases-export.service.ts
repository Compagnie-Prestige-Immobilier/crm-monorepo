import type { Writable } from 'node:stream';

import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { BANK_CASE_FROM, bankCaseConditions } from './bank-cases.sql.js';
import { BankCaseAnalyticsService } from './bank-cases-analytics.service.js';
import { BANK_CASE_INCLUDE, BANK_TRANSITION_INCLUDE } from './mappers.js';
import type { BankCaseRow, BankTransitionRow } from './mappers.js';
import { moneyToNumber, moneyToString } from './money.js';
import type { BankCaseFilterDto } from './dto.js';

/** Bordeaux CPI. ARGB sans dièse : exceljs n'accepte pas la notation CSS. */
const CPI_BURGUNDY = 'FF630210';

/** Taille de page de lecture. Borne la mémoire quel que soit le volume exporté. */
const PAGE_SIZE = 500;

/**
 * Horodatage.
 *
 * Le fuseau de référence est `Africa/Dakar`, qui est à UTC+00:00 toute
 * l'année — pas d'heure d'été, pas de décalage historique en vigueur. Une date
 * UTC écrite telle quelle EST donc l'heure de Dakar ; aucune conversion n'est
 * appliquée, et c'est volontaire : convertir vers le fuseau du serveur
 * produirait un fichier différent selon la machine qui l'a généré.
 *
 * Le format est imposé à la colonne : sans lui, Excel applique la locale du
 * poste et le même fichier se lit `08/12/2026` à Dakar et `12/08/2026`
 * ailleurs.
 */
const DATE_FORMAT = 'dd/mm/yyyy hh:mm';

/** XOF n'a pas de décimales. Le séparateur de milliers suit la locale du poste. */
const MONEY_FORMAT = '#,##0" FCFA"';

const SHEET_CASES = 'Dossiers';
const SHEET_HISTORY = 'Historique';
const SHEET_SUMMARY = 'Synthèse';

@Injectable()
export class BankCasesExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: BankCaseAnalyticsService,
  ) {}

  /**
   * Écrit le classeur DIRECTEMENT dans le flux de réponse.
   *
   * `WorkbookWriter` émet le XML au fil de l'eau : le classeur complet n'est
   * jamais matérialisé en mémoire. Sur plusieurs dizaines de milliers de
   * dossiers, la variante `Workbook` tiendrait tout le fichier en RAM et ferait
   * tomber le conteneur.
   *
   * Le filtre est celui de la liste, mot pour mot : l'agent exporte exactement
   * ce qu'il voit à l'écran.
   */
  async write(filter: BankCaseFilterDto, stream: Writable): Promise<void> {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true });
    workbook.creator = 'CPI GO';
    workbook.created = new Date();

    const cases = workbook.addWorksheet(SHEET_CASES, { views: [{ state: 'frozen', ySplit: 1 }] });
    cases.columns = [
      { header: 'Référence', key: 'reference', width: 22 },
      { header: 'Client', key: 'customer', width: 28 },
      { header: 'Téléphone', key: 'phone', width: 18 },
      { header: 'Banque de traitement', key: 'bank', width: 24 },
      { header: 'Étape', key: 'stage', width: 22 },
      { header: 'Montant', key: 'amount', width: 18, style: { numFmt: MONEY_FORMAT } },
      { header: 'Motif de rejet', key: 'reason', width: 26 },
      { header: 'Détail du rejet', key: 'detail', width: 34 },
      { header: 'Créé par', key: 'createdBy', width: 24 },
      { header: 'Dernier agent', key: 'updatedBy', width: 24 },
      { header: 'Créé le', key: 'createdAt', width: 20, style: { numFmt: DATE_FORMAT } },
      { header: 'Mis à jour le', key: 'updatedAt', width: 20, style: { numFmt: DATE_FORMAT } },
    ];
    styleHeader(cases);
    cases.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: cases.columns.length },
    };

    const history = workbook.addWorksheet(SHEET_HISTORY, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    history.columns = [
      { header: 'Référence', key: 'reference', width: 22 },
      { header: 'Client', key: 'customer', width: 28 },
      { header: 'Étape source', key: 'from', width: 22 },
      { header: 'Étape cible', key: 'to', width: 22 },
      { header: 'Agent', key: 'agent', width: 24 },
      { header: 'Commentaire', key: 'comment', width: 34 },
      { header: 'Montant', key: 'amount', width: 18, style: { numFmt: MONEY_FORMAT } },
      { header: 'Motif de rejet', key: 'reason', width: 26 },
      { header: 'Justification de correction', key: 'correction', width: 34 },
      { header: 'Date', key: 'date', width: 20, style: { numFmt: DATE_FORMAT } },
    ];
    styleHeader(history);
    history.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: history.columns.length },
    };

    // Pagination keyset sur l'identifiant : stable même si des dossiers changent
    // pendant l'export, contrairement à un OFFSET qui saute ou répète des lignes
    // dès qu'une insertion se glisse entre deux pages.
    let after: string | undefined;
    let exported = 0;
    for (;;) {
      const ids = await this.pageIds(filter, after);
      if (ids.length === 0) break;

      const rows = await this.prisma.bankCase.findMany({
        where: { id: { in: ids } },
        include: BANK_CASE_INCLUDE,
        orderBy: { id: 'asc' },
      });
      for (const row of rows) {
        cases.addRow(caseRow(row)).commit();
        exported += 1;
      }

      const transitions = await this.prisma.bankCaseTransition.findMany({
        where: { caseId: { in: ids } },
        include: BANK_TRANSITION_INCLUDE,
        orderBy: [{ caseId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      });
      const byId = new Map(rows.map((row) => [row.id, row]));
      for (const transition of transitions) {
        const parent = byId.get(transition.caseId);
        if (parent) history.addRow(historyRow(parent, transition)).commit();
      }

      after = ids.at(-1);
      if (ids.length < PAGE_SIZE) break;
    }

    cases.commit();
    history.commit();

    await this.writeSummary(workbook, filter, exported);
    await workbook.commit();
  }

  private async writeSummary(
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
    filter: BankCaseFilterDto,
    exported: number,
  ): Promise<void> {
    const [totals, byStage, byBank, byReason] = await Promise.all([
      this.analytics.totals(filter),
      this.analytics.byStage(filter),
      this.analytics.byBank(filter),
      this.analytics.byRejectionReason(filter),
    ]);

    const summary = workbook.addWorksheet(SHEET_SUMMARY);
    summary.columns = [
      { header: 'Indicateur', key: 'label', width: 36 },
      { header: 'Valeur', key: 'value', width: 20 },
      { header: 'Part (%)', key: 'share', width: 12 },
    ];
    styleHeader(summary);

    const section = (title: string): void => {
      const row = summary.addRow({ label: title });
      row.font = { bold: true, color: { argb: CPI_BURGUNDY } };
      row.commit();
    };

    section('Vue d’ensemble');
    summary.addRow({ label: 'Dossiers exportés', value: exported }).commit();
    summary.addRow({ label: 'Dossiers (total filtré)', value: totals.total }).commit();
    summary.addRow({ label: 'À traiter', value: totals.aTraiter }).commit();
    summary.addRow({ label: 'En traitement', value: totals.enTraitement }).commit();
    summary.addRow({ label: 'Encaissés', value: totals.encaisses }).commit();
    summary.addRow({ label: 'Rejetés', value: totals.rejetes }).commit();
    const cashed = summary.addRow({
      label: 'Montant encaissé',
      value: moneyToNumber(totals.totalAmountCashed),
    });
    cashed.getCell('value').numFmt = MONEY_FORMAT;
    cashed.commit();
    summary.addRow({ label: 'Taux de rejet (%)', value: totals.rejectionRate }).commit();
    summary
      .addRow({ label: 'Délai moyen de traitement (h)', value: totals.meanDelayHours ?? '—' })
      .commit();

    summary.addRow({}).commit();
    section('Par étape');
    for (const stage of byStage) {
      summary.addRow({ label: stage.label, value: stage.cases, share: stage.share }).commit();
    }

    summary.addRow({}).commit();
    section('Par banque de traitement');
    for (const bank of byBank) {
      const row = summary.addRow({ label: bank.label, value: bank.cases, share: bank.share });
      row.commit();
    }

    summary.addRow({}).commit();
    section('Montant encaissé par banque');
    for (const bank of byBank) {
      const row = summary.addRow({ label: bank.label, value: moneyToNumber(bank.amountXof) });
      row.getCell('value').numFmt = MONEY_FORMAT;
      row.commit();
    }

    summary.addRow({}).commit();
    section('Par motif de rejet');
    if (byReason.length === 0) summary.addRow({ label: 'Aucun rejet', value: 0 }).commit();
    for (const reason of byReason) {
      summary.addRow({ label: reason.label, value: reason.cases, share: reason.share }).commit();
    }

    summary.commit();
  }

  /** Une page d'identifiants, filtrée par la MÊME requête que la liste et les agrégats. */
  private async pageIds(filter: BankCaseFilterDto, after: string | undefined): Promise<string[]> {
    const where = bankCaseConditions(filter);
    const keyset = after === undefined ? Prisma.sql`` : Prisma.sql`AND c."id" > ${after}`;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c."id" ${BANK_CASE_FROM} WHERE ${where} ${keyset}
      ORDER BY c."id" ASC LIMIT ${PAGE_SIZE}
    `;
    return rows.map((row) => row.id);
  }
}

function caseRow(row: BankCaseRow): Record<string, string | number | Date | null> {
  return {
    reference: row.reference,
    customer: row.customerName,
    phone: row.customerPhoneE164,
    bank: row.processingBank.name,
    stage: row.currentStage.label,
    amount: moneyToNumber(moneyToString(row.amountXof)),
    reason: row.rejectionReason?.label ?? '',
    detail: row.rejectionDetail ?? '',
    createdBy: row.createdBy.fullName,
    updatedBy: row.updatedBy?.fullName ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function historyRow(
  parent: BankCaseRow,
  row: BankTransitionRow,
): Record<string, string | number | Date | null> {
  return {
    reference: parent.reference,
    customer: parent.customerName,
    from: row.fromStage?.label ?? 'Ouverture',
    to: row.toStage.label,
    agent: row.performedBy.fullName,
    comment: row.comment ?? '',
    amount: moneyToNumber(moneyToString(row.amountXof)),
    reason: row.rejectionReason?.label ?? '',
    correction: row.correctionReason ?? '',
    date: row.createdAt,
  };
}

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CPI_BURGUNDY } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  header.height = 22;
  header.commit();
}
