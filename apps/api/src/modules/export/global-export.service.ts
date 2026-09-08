import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Projet } from '@crm/database';
import ExcelJS from 'exceljs';

import { PrismaService } from '../../prisma/prisma.service.js';
import { WorkspaceContext } from '../../workspaces/workspace.js';
import { ChampsConversionService } from '../champs-conversion/champs-conversion.service.js';
import { readDistribution } from '../lots-export/lots-export.service.js';
import { capaciteParJour } from '../lots-export/repartition.js';
import { whatsappNumberOf } from '../representants/whatsapp.js';
import {
  CALL_OUTCOME_LABELS,
  ENROLLMENT_METHOD_LABELS,
  PHASE2_STATUS_LABELS,
  PROJET_LABELS,
  PROSPECT_STATUT_LABELS,
} from '../prospects/phase2-labels.js';
import { EXPORT_INCLUDE, prospectColumns, cellValue } from './columns.js';
import { markWorkbook } from './demo-marking.js';
import { toDakarCell } from './dakar.js';

type Value = string | number | boolean | Date | null | undefined;
type Tx = Prisma.TransactionClient;
const PAGE_SIZE = 500;
const PERSON = { select: { id: true, fullName: true } } as const;
const CONTACT = { select: { id: true, nom: true, prenom: true, phoneE164: true } } as const;
const REP = { select: { id: true, fullName: true, phoneE164: true } } as const;
const ACTIVE = { deletedAt: null } as const;
const RELATIONS = {
  INCONNU: 'Inconnu',
  CONTACTE: 'Contacté',
  AMBASSADEUR: 'Ambassadeur',
  REFUS: 'Refus',
} as const;
const WHATSAPP = {
  NON_DEMANDE: 'Non demandé',
  MEME_NUMERO: 'Même numéro',
  AUTRE_NUMERO: 'Autre numéro',
  AUCUN: 'Aucun',
} as const;
const REP_OUTCOMES = {
  REACHED: 'Joint',
  PROSPECTS_PROMISED: 'Prospects promis',
  UNREACHABLE: 'Injoignable',
  CALLBACK: 'À rappeler',
  REFUSED: 'Refus',
  WRONG_NUMBER: 'Faux numéro',
  OTHER: 'Autre',
} as const;
const CALLBACKS = {
  PENDING: 'En attente',
  DONE: 'Effectué',
  CANCELLED: 'Annulé',
  SUPERSEDED: 'Remplacé',
} as const;
const PAYMENTS = { COMPTANT: 'Comptant', ECHELONNE: 'Échelonné' } as const;
const CONSENTS = { NON_DEMANDE: 'Non demandé', INTERESSE: 'Intéressé', REFUSE: 'Refusé' } as const;
const SUGGESTIONS = { A_APPELER: 'À appeler', APPELE: 'Appelé', ABANDONNE: 'Abandonné' } as const;

const fullName = (row: { nom: string; prenom: string }): string =>
  `${row.prenom} ${row.nom}`.trim();
const page = (after?: string) => ({
  take: PAGE_SIZE,
  orderBy: { id: 'asc' as const },
  ...(after ? { cursor: { id: after }, skip: 1 } : {}),
});

async function eachPage<T extends { id: string }>(
  load: (after?: string) => Promise<T[]>,
  consume: (row: T) => void | Promise<void>,
): Promise<void> {
  let after: string | undefined;
  for (;;) {
    const rows = await load(after);
    for (const row of rows) await consume(row);
    if (rows.length < PAGE_SIZE) return;
    after = rows.at(-1)?.id;
  }
}

function cell(value: Value): ExcelJS.CellValue {
  if (value instanceof Date) return toDakarCell(value);
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'string' && value.length > 32_767) {
    throw new BadRequestException('Un texte dépasse la capacité d’une cellule Excel.');
  }
  return value ?? null;
}

function sheet(book: ExcelJS.Workbook, name: string, headers: string[]): (values: Value[]) => void {
  const ws = book.addWorksheet(name, { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] });
  const used = new Set<string>();
  ws.addRow(
    headers.map((header) => {
      let label = header;
      let suffix = 2;
      while (used.has(label.toLocaleLowerCase('fr'))) label = `${header} (${String(suffix++)})`;
      used.add(label.toLocaleLowerCase('fr'));
      return label;
    }),
  );
  return (values) => {
    if (ws.rowCount >= 1_048_576)
      throw new BadRequestException(`L’onglet ${name} dépasse la capacité d’Excel.`);
    if (values.length !== headers.length) throw new Error(`Colonnes incohérentes : ${name}`);
    ws.addRow(values.map(cell));
  };
}

function finish(book: ExcelJS.Workbook): void {
  for (const ws of book.worksheets) {
    if (ws.name !== 'Tableau de bord') {
      const columns = Array.from({ length: ws.columnCount }, (_, i) => ({
        name: ws.getRow(1).getCell(i + 1).text,
        filterButton: true,
      }));
      const rows: ExcelJS.CellValue[][] = [];
      ws.eachRow((row, index) => {
        if (index > 1) rows.push(columns.map((_, i) => row.getCell(i + 1).value));
      });
      ws.addTable({
        name: `Donnees${String(ws.id)}`,
        ref: 'A1',
        headerRow: true,
        columns,
        rows,
        style: { theme: 'TableStyleLight1', showRowStripes: false },
      });
    }
    ws.columns.forEach((column, index) => {
      const header = ws.getRow(1).getCell(index + 1).text;
      column.width = Math.min(45, Math.max(22, header.length + 4));
      if (/Identifiant|Référence/u.test(header)) column.width = 39;
      if (/Commentaire|Notes/u.test(header)) column.width = 55;
    });
    ws.eachRow((row, index) => {
      row.height = 24;
      row.eachCell({ includeEmpty: true }, (value) => {
        value.font = { name: 'Arial', size: 14, color: { argb: 'FF222222' }, bold: index === 1 };
        value.alignment = { vertical: 'top', wrapText: true };
        if (index === 1)
          value.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
        if (value.value instanceof Date) value.numFmt = 'dd/mm/yyyy hh:mm';
        if (typeof value.value === 'string') value.numFmt = '@';
        const width = (ws.getColumn(value.col).width ?? 22) * 0.7;
        const displayText = typeof value.value === 'string' ? value.value : '';
        const lines = displayText
          .split('\n')
          .reduce((count, line) => count + Math.max(1, Math.ceil(line.length / width)), 0);
        row.height = Math.min(409, Math.max(row.height ?? 24, lines * 24));
      });
    });
  }
}

@Injectable()
export class GlobalExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
  ) {}

  async build(): Promise<ExcelJS.Workbook> {
    const book = new ExcelJS.Workbook();
    markWorkbook(book, this.workspace.current() === 'demo');
    const dashboard = book.addWorksheet('Tableau de bord', {
      views: [{ showGridLines: false }],
      properties: { defaultRowHeight: 24 },
    });
    dashboard.addRow(['Synthèse au', toDakarCell(book.created)]);
    if (this.workspace.current() === 'demo') dashboard.addRow(['Données de démonstration']);
    dashboard.addRow(['Groupe', 'Libellé', 'Nombre']);
    await this.prisma.$transaction(
      async (tx) => {
        await representatives(tx, book);
        await prospects(tx, book);
        await journeys(tx, book);
        await calls(tx, book);
        await campaigns(tx, book);
        await history(tx, book);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000 },
    );
    summarize(book);
    finish(book);
    return book;
  }
}

async function representatives(tx: Tx, book: ExcelJS.Workbook): Promise<void> {
  const add = sheet(book, 'Représentants', [
    'Identifiant',
    'Nom complet',
    'Prénom',
    'Téléphone',
    'Établissement',
    'Région',
    'Département',
    'IEF',
    'Téléconseiller',
    'Identifiant téléconseiller',
    'Relation',
    'Qualification',
    'Statut WhatsApp',
    'WhatsApp',
    'Profession',
    'Syndicat',
    'Connaît UES',
    'Déjà contacté',
    'Notes',
    'Dernier résultat',
    'Dernier appel',
    'Dernier appel par',
    'Relance',
    'Origine relance',
    'Saisi le',
    'Créé le',
    'Modifié le',
    'Prospects',
  ]);
  const reminder = sheet(book, 'Relances', [
    'Identifiant',
    'Type',
    'Identifiant fiche',
    'Nom',
    'Téléphone',
    'Téléconseiller',
    'Identifiant téléconseiller',
    'Échéance',
    'État',
    'Commentaire',
    'Appel source',
    'Appel de clôture',
    'Créé le',
    'Modifié le',
  ]);
  await eachPage(
    (after) =>
      tx.representant.findMany({
        ...page(after),
        where: ACTIVE,
        include: {
          departement: { include: { region: true } },
          ief: true,
          createdBy: PERSON,
          lastCallBy: PERSON,
          statutQualification: true,
          _count: { select: { prospects: { where: ACTIVE } } },
        },
      }),
    (row) => {
      add([
        row.id,
        row.fullName,
        row.prenom,
        row.phoneE164,
        row.etablissement,
        row.departement.region.name,
        row.departement.name,
        row.ief?.name,
        row.createdBy.fullName,
        row.createdById,
        RELATIONS[row.relationStatus],
        row.statutQualification?.label,
        WHATSAPP[row.whatsappStatus],
        whatsappNumberOf(row),
        row.profession,
        row.syndicat,
        row.connaitUES,
        row.contacte,
        row.notes,
        row.lastCallOutcome && REP_OUTCOMES[row.lastCallOutcome],
        row.lastCallAt,
        row.lastCallBy?.fullName,
        row.nextCallbackAt,
        row.nextCallbackOrigine,
        row.clientCreatedAt,
        row.createdAt,
        row.updatedAt,
        row._count.prospects,
      ]);
      if (row.nextCallbackAt)
        reminder([
          row.id,
          'Représentant',
          row.id,
          row.fullName,
          row.phoneE164,
          row.lastCallBy?.fullName,
          row.lastCallById,
          row.nextCallbackAt,
          'En attente',
          null,
          null,
          null,
          null,
          row.updatedAt,
        ]);
    },
  );
  await eachPage(
    (after) =>
      tx.scheduledCallback.findMany({
        ...page(after),
        where: { prospect: ACTIVE },
        include: { prospect: CONTACT, assignedTo: PERSON },
      }),
    (row) => {
      reminder([
        row.id,
        'Prospect',
        row.prospectId,
        fullName(row.prospect),
        row.prospect.phoneE164,
        row.assignedTo.fullName,
        row.assignedToId,
        row.scheduledAt,
        CALLBACKS[row.status],
        row.comment,
        row.sourceAttemptId,
        row.closedAttemptId,
        row.createdAt,
        row.updatedAt,
      ]);
    },
  );
}

async function prospects(tx: Tx, book: ExcelJS.Workbook): Promise<void> {
  const settings = new ChampsConversionService(tx as PrismaService);
  const libres = [];
  for (const projet of Object.values(Projet)) libres.push(...(await settings.champsLibres(projet)));
  const unique = [...new Map(libres.map((champ) => [champ.id, champ])).values()];
  const columns = prospectColumns(unique);
  const used = new Set<string>();
  const headers = columns.map((column) => {
    const label = column.header === 'Commercial' ? 'Téléconseiller' : column.header;
    const name = used.has(label) ? `${label} (${column.key})` : label;
    used.add(name);
    return name;
  });
  const add = sheet(book, 'Prospects', [
    'Identifiant',
    'Identifiant représentant',
    ...headers,
    'Identifiant téléconseiller',
    'Projet d’origine',
    'Établissement',
    'E-mail',
    'Revenu mensuel',
    'Paiement',
    'Statut WhatsApp',
    'Origine',
    'Détail origine',
    'À revoir depuis',
    'Revu le',
    'Revu par',
    'Créé le',
    'Modifié le',
  ]);
  await eachPage(
    (after) =>
      tx.prospect.findMany({
        ...page(after),
        where: ACTIVE,
        include: {
          ...EXPORT_INCLUDE,
          incomeBand: true,
          revueBy: PERSON,
          _count: { select: { callAttempts: true } },
          callAttempts: { take: 1, orderBy: [{ clientCreatedAt: 'desc' }, { id: 'desc' }] },
        },
      }),
    (row) => {
      const last = row.callAttempts[0];
      const attempt = last
        ? { ...last, at: last.clientCreatedAt, count: row._count.callAttempts }
        : undefined;
      add([
        row.id,
        row.representantId,
        ...columns.map((column) => cellValue(column, row, attempt)),
        row.createdById,
        PROJET_LABELS[row.projet],
        row.etablissement,
        row.email,
        row.incomeBand?.label,
        row.paymentMode && PAYMENTS[row.paymentMode],
        WHATSAPP[row.whatsappStatus],
        row.origin,
        row.originLabel,
        row.aRevoirAt,
        row.revueAt,
        row.revueBy?.fullName,
        row.createdAt,
        row.updatedAt,
      ]);
    },
  );
}

async function journeys(tx: Tx, book: ExcelJS.Workbook): Promise<void> {
  const add = sheet(book, 'Parcours', [
    'Identifiant',
    'Identifiant prospect',
    'Nom',
    'Téléphone',
    'Projet',
    'Statut',
    'Consentement',
    'Consentement le',
    'Consentement par',
    'Phase de conversion',
    'Méthode',
    'Méthode obtenue le',
    'Méthode obtenue par',
    'Converti le',
    'Converti par',
    'Fermé le',
    'Motif fermeture',
    'Fermé par',
    'Créé le',
    'Modifié le',
  ]);
  await eachPage(
    (after) =>
      tx.prospectJourney.findMany({
        ...page(after),
        where: { prospect: ACTIVE },
        include: {
          prospect: CONTACT,
          consentBy: PERSON,
          enrollmentCapturedBy: PERSON,
          convertedBy: PERSON,
          closedBy: PERSON,
        },
      }),
    (row) => {
      add([
        row.id,
        row.prospectId,
        fullName(row.prospect),
        row.prospect.phoneE164,
        PROJET_LABELS[row.projet],
        PROSPECT_STATUT_LABELS[row.statut],
        CONSENTS[row.consent],
        row.consentAt,
        row.consentBy?.fullName,
        PHASE2_STATUS_LABELS[row.phase2Status],
        row.enrollmentMethod && ENROLLMENT_METHOD_LABELS[row.enrollmentMethod],
        row.enrollmentCapturedAt,
        row.enrollmentCapturedBy?.fullName,
        row.convertedAt,
        row.convertedBy?.fullName,
        row.closedAt,
        row.closedReason,
        row.closedBy?.fullName,
        row.createdAt,
        row.updatedAt,
      ]);
    },
  );
  const convert = sheet(book, 'Conversions', [
    'Identifiant',
    'Identifiant parcours',
    'Identifiant prospect',
    'Nom',
    'Projet',
    'Offre',
    'Paiement',
    'Montant XOF',
    'Durée en mois',
    'Confirmé par',
    'Identifiant téléconseiller',
    'Confirmé le',
  ]);
  await eachPage(
    (after) =>
      tx.prospectConversion.findMany({
        ...page(after),
        where: { journey: { prospect: ACTIVE } },
        include: { journey: { include: { prospect: CONTACT } }, offer: true, confirmedBy: PERSON },
      }),
    (row) => {
      convert([
        row.id,
        row.journeyId,
        row.journey.prospectId,
        fullName(row.journey.prospect),
        PROJET_LABELS[row.journey.projet],
        row.offer?.label,
        row.paymentMode && PAYMENTS[row.paymentMode],
        row.amountXof,
        row.durationMonths,
        row.confirmedBy.fullName,
        row.confirmedById,
        row.confirmedAt,
      ]);
    },
  );
}

async function calls(tx: Tx, book: ExcelJS.Workbook): Promise<void> {
  const add = sheet(book, 'Appels', [
    'Identifiant',
    'Type',
    'Identifiant fiche',
    'Nom',
    'Téléphone',
    'Téléconseiller',
    'Identifiant téléconseiller',
    'Date',
    'Résultat',
    'Motif',
    'Commentaire',
    'Méthode',
    'Rendez-vous',
    'E-mail',
    'Fonctionnaire',
    'Engagement bancaire',
    'Ancienneté établissement en mois',
    'Prospects promis',
    'Rappel promis',
    'Établissement confirmé',
    'Numéro confirmé',
    'Déjà contacté',
    'Connaît UES',
    'Syndicat',
    'Qualification',
    'Type appel appareil',
    'Durée en secondes',
    'Date appel appareil',
    'Créé le',
  ]);
  await eachPage(
    (after) =>
      tx.callAttempt.findMany({
        ...page(after),
        where: { prospect: ACTIVE },
        include: { prospect: CONTACT, performedBy: PERSON, reason: true },
      }),
    (row) => {
      add([
        row.id,
        'Prospect',
        row.prospectId,
        fullName(row.prospect),
        row.prospect.phoneE164,
        row.performedBy.fullName,
        row.performedById,
        row.clientCreatedAt,
        CALL_OUTCOME_LABELS[row.outcome],
        row.reason?.label,
        row.comment,
        row.method && ENROLLMENT_METHOD_LABELS[row.method],
        row.rendezVousAt,
        row.email,
        row.fonctionnaire,
        row.engagementEnCours,
        row.dureeEtablissementMois,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        row.deviceCallType,
        row.deviceCallDurationSeconds,
        row.deviceCallAt,
        row.createdAt,
      ]);
    },
  );
  await eachPage(
    (after) =>
      tx.repCallAttempt.findMany({
        ...page(after),
        where: { representant: ACTIVE },
        include: { representant: REP, performedBy: PERSON, statutQualification: true },
      }),
    (row) => {
      add([
        row.id,
        'Représentant',
        row.representantId,
        row.representant.fullName,
        row.representant.phoneE164,
        row.performedBy.fullName,
        row.performedById,
        row.clientCreatedAt,
        REP_OUTCOMES[row.outcome],
        null,
        row.comment,
        null,
        null,
        null,
        null,
        null,
        null,
        row.promisedProspects,
        row.callbackAt,
        row.etablissementConfirme,
        row.numeroConfirme,
        row.contacte,
        row.connaitUES,
        row.syndicat,
        row.statutQualification?.label,
        row.deviceCallType,
        row.deviceCallDurationSeconds,
        row.deviceCallAt,
        row.createdAt,
      ]);
    },
  );
}

async function campaigns(tx: Tx, book: ExcelJS.Workbook): Promise<void> {
  const add = sheet(book, 'Campagnes', [
    'Identifiant',
    'Nom',
    'Type',
    'Projet',
    'Fiches à la création',
    'Jours prévus',
    'Fiches par jour',
    'Créé par',
    'Identifiant téléconseiller',
    'Créé le',
  ]);
  const assign = sheet(book, 'Affectations', [
    'Identifiant campagne',
    'Campagne',
    'Position',
    'Jour',
    'Type',
    'Identifiant fiche',
    'Nom',
    'Téléphone',
    'Téléconseiller',
    'Identifiant téléconseiller',
    'Objectif quotidien',
    'Dernier résultat',
    'Dernier appel',
  ]);
  await eachPage(
    (after) => tx.lotExport.findMany({ ...page(after), include: { createdBy: PERSON } }),
    async (row) => {
      const distribution = readDistribution(row.filters);
      add([
        row.id,
        row.name,
        row.cible === 'PROSPECTS'
          ? 'Campagne d’appels prospects'
          : 'Campagne d’appels représentants',
        PROJET_LABELS[row.projet],
        row.itemCount,
        distribution?.jours,
        distribution?.fichesParJour,
        row.createdBy.fullName,
        row.createdById,
        row.createdAt,
      ]);
      await assignments(tx, row, assign);
    },
  );
}

const ITEM_INCLUDE = {
  prospect: { select: { ...CONTACT.select, lastCallAt: true, lastCallOutcome: true } },
  representant: { select: { ...REP.select, lastCallAt: true, lastCallOutcome: true } },
  assignee: { select: { id: true, fullName: true, role: true } },
} as const;
type Assignment = Prisma.LotExportItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

function assignmentContact(item: Assignment): { identity: Value[]; followup: Value[] } {
  const p = item.prospect;
  if (p)
    return {
      identity: ['Prospect', p.id, fullName(p), p.phoneE164],
      followup: [p.lastCallOutcome && CALL_OUTCOME_LABELS[p.lastCallOutcome], p.lastCallAt],
    };
  const r = item.representant;
  if (!r) throw new Error('Affectation sans fiche');
  return {
    identity: ['Représentant', r.id, r.fullName, r.phoneE164],
    followup: [r.lastCallOutcome && REP_OUTCOMES[r.lastCallOutcome], r.lastCallAt],
  };
}

async function assignments(
  tx: Tx,
  lot: { id: string; name: string; filters: Prisma.JsonValue },
  add: (values: Value[]) => void,
): Promise<void> {
  const distribution = readDistribution(lot.filters);
  let position = -1;
  for (;;) {
    const items = await tx.lotExportItem.findMany({
      where: {
        lotId: lot.id,
        position: { gt: position },
        OR: [{ prospect: ACTIVE }, { representant: ACTIVE }],
      },
      orderBy: { position: 'asc' },
      take: PAGE_SIZE,
      include: ITEM_INCLUDE,
    });
    items.forEach((item) => {
      const contact = assignmentContact(item);
      let goal: number | undefined;
      if (item.assignee && distribution)
        goal =
          distribution.objectifs[item.assignee.id] ??
          capaciteParJour(item.assignee.role, distribution.fichesParJour);
      add([
        lot.id,
        lot.name,
        item.position,
        item.day,
        ...contact.identity,
        item.assignee?.fullName,
        item.assigneeId,
        goal,
        ...contact.followup,
      ]);
    });
    if (items.length < PAGE_SIZE) return;
    position = items.at(-1)?.position ?? position;
  }
}

async function history(tx: Tx, book: ExcelJS.Workbook): Promise<void> {
  const comment = sheet(book, 'Commentaires', [
    'Identifiant',
    'Identifiant représentant',
    'Nom',
    'Téléphone',
    'Commentaire',
    'Auteur',
    'Identifiant auteur',
    'Date',
    'Créé le',
  ]);
  await eachPage(
    (after) =>
      tx.representantComment.findMany({
        ...page(after),
        where: { ...ACTIVE, representant: ACTIVE },
        include: { representant: REP, author: PERSON },
      }),
    (row) => {
      comment([
        row.id,
        row.representantId,
        row.representant.fullName,
        row.representant.phoneE164,
        row.body,
        row.author.fullName,
        row.authorId,
        row.clientCreatedAt,
        row.createdAt,
      ]);
    },
  );
  const change = sheet(book, 'Historique', [
    'Identifiant',
    'Type',
    'Identifiant fiche ou campagne',
    'Nom',
    'Avant',
    'Après',
    'Motif',
    'Auteur',
    'Identifiant auteur',
    'Date',
    'Source',
    'Fiches',
    'Positions',
    'Banque avant',
    'Banque après',
    'Syndicat avant',
    'Syndicat après',
  ]);
  const banques = new Map(
    (await tx.banque.findMany({ select: { id: true, name: true } })).map((row) => [
      row.id,
      row.name,
    ]),
  );
  const syndicats = new Map(
    (await tx.syndicat.findMany({ select: { id: true, sigle: true } })).map((row) => [
      row.id,
      row.sigle,
    ]),
  );
  await eachPage(
    (after) =>
      tx.segmentChange.findMany({
        ...page(after),
        where: { prospect: ACTIVE },
        include: { prospect: CONTACT, changedBy: PERSON },
      }),
    (row) => {
      change([
        row.id,
        'Segment',
        row.prospectId,
        fullName(row.prospect),
        row.fromSegment,
        row.toSegment,
        row.reason,
        row.changedBy.fullName,
        row.changedById,
        row.changedAt,
        row.source,
        null,
        null,
        banques.get(row.fromBanqueId) ?? row.fromBanqueId,
        banques.get(row.toBanqueId) ?? row.toBanqueId,
        syndicats.get(row.fromSyndicatId) ?? row.fromSyndicatId,
        syndicats.get(row.toSyndicatId) ?? row.toSyndicatId,
      ]);
    },
  );
  await eachPage(
    (after) =>
      tx.representantRelationChange.findMany({
        ...page(after),
        where: { representant: ACTIVE },
        include: { representant: REP, changedBy: PERSON },
      }),
    (row) => {
      change([
        row.id,
        'Relation',
        row.representantId,
        row.representant.fullName,
        RELATIONS[row.fromStatus],
        RELATIONS[row.toStatus],
        row.reason,
        row.changedBy.fullName,
        row.changedById,
        row.changedAt,
        row.source,
        null,
        null,
        null,
        null,
        null,
        null,
      ]);
    },
  );
  await eachPage(
    (after) =>
      tx.lotExportReaffectation.findMany({
        ...page(after),
        include: {
          lot: { select: { name: true } },
          fromAssignee: PERSON,
          toAssignee: PERSON,
          performedBy: PERSON,
        },
      }),
    (row) => {
      change([
        row.id,
        'Réaffectation',
        row.lotId,
        row.lot.name,
        row.fromAssignee?.fullName,
        row.toAssignee.fullName,
        null,
        row.performedBy.fullName,
        row.performedById,
        row.createdAt,
        null,
        row.fiches,
        row.positions.join(', '),
        null,
        null,
        null,
        null,
      ]);
    },
  );
  const suggest = sheet(book, 'Suggestions', [
    'Identifiant',
    'Identifiant représentant source',
    'Représentant source',
    'Nom suggéré',
    'Téléphone suggéré',
    'Note',
    'Suggéré par',
    'Identifiant téléconseiller',
    'État',
    'Identifiant représentant retrouvé',
    'Représentant retrouvé',
    'Appel source',
    'Date',
    'Créé le',
  ]);
  await eachPage(
    (after) =>
      tx.representantSuggestion.findMany({
        ...page(after),
        where: { ...ACTIVE, sourceRepresentant: ACTIVE },
        include: { sourceRepresentant: REP, resolvedRepresentant: REP, suggestedBy: PERSON },
      }),
    (row) => {
      suggest([
        row.id,
        row.sourceRepresentantId,
        row.sourceRepresentant.fullName,
        row.suggestedName,
        row.suggestedPhoneE164,
        row.note,
        row.suggestedBy.fullName,
        row.suggestedById,
        SUGGESTIONS[row.status],
        row.resolvedRepresentantId,
        row.resolvedRepresentant?.fullName,
        row.sourceAttemptId,
        row.clientCreatedAt,
        row.createdAt,
      ]);
    },
  );
}

function summarize(book: ExcelJS.Workbook): void {
  const dashboard = book.getWorksheet('Tableau de bord');
  if (!dashboard) throw new Error('Synthèse absente');
  for (const name of ['Représentants', 'Prospects', 'Conversions', 'Appels', 'Campagnes'])
    dashboard.addRow(['Totaux', name, (book.getWorksheet(name)?.rowCount ?? 1) - 1]);
  for (const [name, header, group] of [
    ['Parcours', 'Statut', 'Parcours par statut'],
    ['Prospects', 'Téléconseiller', 'Prospects par téléconseiller'],
    ['Prospects', 'Segment', 'Prospects par segment'],
    ['Appels', 'Date', 'Appels par mois'],
    ['Relances', 'État', 'Relances par état'],
  ]) {
    const ws = book.getWorksheet(name);
    if (!ws) throw new Error(`Onglet absent : ${name}`);
    const column = Array.from({ length: ws.columnCount }, (_, i) => i + 1).find(
      (i) => ws.getRow(1).getCell(i).text === header,
    );
    if (!column) throw new Error(`Colonne absente : ${header}`);
    const counts = new Map<string, number>();
    ws.eachRow((row, index) => {
      if (index === 1) return;
      const value = row.getCell(column).value;
      const label =
        value instanceof Date ? value.toISOString().slice(0, 7) : row.getCell(column).text;
      counts.set(label || 'Non renseigné', (counts.get(label || 'Non renseigné') ?? 0) + 1);
    });
    for (const [label, count] of [...counts].sort(([a], [b]) => a.localeCompare(b, 'fr')))
      dashboard.addRow([group, label, count]);
  }
}
