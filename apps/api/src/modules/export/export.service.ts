import type { Writable } from 'node:stream';

import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { ALL_SEGMENTS } from '@crm/database';
import type { BddSegment, Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { buildProspectWhere } from '../../common/prospect-where.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import { lastAttemptsByProspect } from '../prospects/last-attempt.js';
import type { LastAttempt } from '../prospects/last-attempt.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { EXPORT_INCLUDE, PROSPECT_COLUMNS, cellValue } from './columns.js';
import type { ExportRow } from './columns.js';
import { CONSOLIDATED_SHEET, ExportMode } from './dto.js';
import { markWorkbook, writeDemoWarningRow } from './demo-marking.js';
import { WorkspaceContext } from '../../workspaces/workspace.js';
import { CPI_BURGUNDY_ARGB } from '../../common/brand.js';
import {
  ENROLLMENT_METHOD_TOKENS,
  PROSPECTS_IMPORT_COLUMNS,
  PROSPECTS_IMPORT_SHEET_NAME,
} from '../imports/prospects-import-template.js';
import {
  FONCTIONNAIRE_CHOICES,
  GRAND_PUBLIC_IMPORT_COLUMNS,
  GRAND_PUBLIC_IMPORT_HEADERS,
  GRAND_PUBLIC_SHEET_NAME,
} from '../imports/prospects-grand-public-template.js';
import {
  COLUMNS_BY_HEADER_RULE,
  COLUMNS_BY_POSITION_RULE,
  COMMON_TEMPLATE_RULES,
  writeImportTemplate,
} from './import-template.workbook.js';

/** ARGB sans le dièse : exceljs n'accepte pas la notation CSS. */
const CPI_BURGUNDY = CPI_BURGUNDY_ARGB;

const PAGE_SIZE = 500;

const MAX_COLUMN_WIDTH = 50;

/** Impose au tableur un format explicite : sans lui Excel applique la locale du poste. */
const DATE_FORMAT = 'dd/mm/yyyy hh:mm';

interface RepresentantTally {
  fullName: string;
  phoneE164: string;
  departement: string;
  commercial: string;
  clientCreatedAt: Date;
  prospects: number;
}

interface SheetResult {
  rows: number;
  representants: Map<string, RepresentantTally>;
}

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly demo: WorkspaceContext,
  ) {}

  /** Banque et Syndicat sont des listes, pas du texte libre : leur croisement est le segment BDD. */
  async writeProspectsImportTemplate(stream: Writable): Promise<void> {
    const [banques, syndicats] = await Promise.all([
      this.prisma.banque.findMany({
        where: { isActive: true },
        select: { shortName: true },
        // Même ordre que `ProspectsImportAdapter.prepare`, qui énumère les valeurs admises.
        orderBy: [{ sortOrder: 'asc' }, { shortName: 'asc' }],
      }),
      this.prisma.syndicat.findMany({
        where: { isActive: true },
        select: { sigle: true },
        orderBy: [{ sortOrder: 'asc' }, { sigle: 'asc' }],
      }),
    ]);

    await writeImportTemplate(stream, {
      sheetName: PROSPECTS_IMPORT_SHEET_NAME,
      columns: PROSPECTS_IMPORT_COLUMNS,
      // Rangs dans `PROSPECTS_IMPORT_COLUMNS`.
      dropdowns: [
        { column: 5, label: 'Banques', values: banques.map((row) => row.shortName) },
        { column: 6, label: 'Syndicats', values: syndicats.map((row) => row.sigle) },
        { column: 7, label: 'Méthodes d’enrôlement', values: [...ENROLLMENT_METHOD_TOKENS] },
      ],
      rules: [
        ...COMMON_TEMPLATE_RULES,
        'Le téléphone du prospect est la clé de déduplication : un numéro déjà en base, ou répété dans le fichier, est signalé et non écrit.',
        'Ce fichier ne crée AUCUN représentant. Chaque « Téléphone du représentant » doit déjà exister : importez les représentants d’abord.',
        'Banque et Syndicat se choisissent dans la liste déroulante. Leur croisement détermine le segment BDD de la fiche : une valeur saisie à la main range la ligne dans le mauvais segment, ou la fait refuser.',
      ],
    });
  }

  /** Grand Public : seuls le nom et le téléphone sont exigés, tout le reste peut rester vide. */
  async writeProspectsGrandPublicImportTemplate(stream: Writable): Promise<void> {
    const [banques, syndicats, canaux] = await Promise.all([
      this.prisma.banque.findMany({
        where: { isActive: true },
        select: { shortName: true },
        orderBy: [{ sortOrder: 'asc' }, { shortName: 'asc' }],
      }),
      this.prisma.syndicat.findMany({
        where: { isActive: true },
        select: { sigle: true },
        orderBy: [{ sortOrder: 'asc' }, { sigle: 'asc' }],
      }),
      // Même ordre que `ProspectsGrandPublicImportAdapter.prepare`, qui énumère
      // les valeurs admises dans ses messages de refus.
      this.prisma.canalProvenance.findMany({
        where: { isActive: true },
        select: { label: true },
        orderBy: [{ position: 'asc' }, { label: 'asc' }],
      }),
    ]);

    const rankOf = (header: string): number =>
      GRAND_PUBLIC_IMPORT_COLUMNS.findIndex((column) => column.header === header) + 1;

    await writeImportTemplate(stream, {
      sheetName: GRAND_PUBLIC_SHEET_NAME,
      columns: GRAND_PUBLIC_IMPORT_COLUMNS,
      dropdowns: [
        {
          column: rankOf(GRAND_PUBLIC_IMPORT_HEADERS.syndicat),
          label: 'Syndicats',
          values: syndicats.map((row) => row.sigle),
        },
        {
          column: rankOf(GRAND_PUBLIC_IMPORT_HEADERS.banque),
          label: 'Banques',
          values: banques.map((row) => row.shortName),
        },
        {
          column: rankOf(GRAND_PUBLIC_IMPORT_HEADERS.fonctionnaire),
          label: 'Fonctionnaire',
          values: [...FONCTIONNAIRE_CHOICES],
        },
        {
          column: rankOf(GRAND_PUBLIC_IMPORT_HEADERS.canal),
          label: 'Canaux de provenance',
          values: canaux.map((row) => row.label),
        },
      ],
      rules: [
        COLUMNS_BY_HEADER_RULE,
        ...COMMON_TEMPLATE_RULES.filter((rule) => rule !== COLUMNS_BY_POSITION_RULE),
        'Seuls le Nom et le Téléphone sont exigés. Une cellule vide n’est pas une erreur : c’est une information qu’on n’a pas encore, et la ligne est écrite quand même.',
        'Le téléphone est la clé de déduplication, tous projets confondus : un numéro déjà porté par une fiche, CHUES comprise, est signalé et non écrit.',
        '« Fonctionnaire » à « oui » range la fiche en FONCTIONNAIRE. À « non », le type reste VIDE : le fichier ne dit pas s’il s’agit du secteur privé, de l’informel ou de la diaspora, et rien ne se devine ici.',
      ],
    });
  }

  /** `WorkbookWriter` + pagination keyset : le classeur n'est jamais materialise en memoire. */
  async writeProspects(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
    stream: Writable,
    mode: ExportMode = ExportMode.FILTERED,
  ): Promise<void> {
    // Lu UNE fois pour tout le classeur : une bascule en cours d'export marquerait
    // une feuille et pas l'autre.
    const demoEnabled = this.demo.current() === 'demo';

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true });
    markWorkbook(workbook, demoEnabled);

    if (mode === ExportMode.CONSOLIDATED) {
      await this.writeConsolidated(user, filter, workbook, demoEnabled);
    } else {
      await this.writeFiltered(user, filter, workbook, demoEnabled);
    }

    await workbook.commit();
  }

  private async writeFiltered(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
    demoEnabled: boolean,
  ): Promise<void> {
    const where = buildProspectWhere(user, filter);
    const { rows: total, representants } = await this.writeProspectSheet(
      workbook,
      'Prospects',
      where,
      demoEnabled,
    );

    const repSheet = workbook.addWorksheet('Représentants', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    repSheet.columns = [
      { header: 'Représentant', key: 'fullName', width: 28 },
      { header: 'Téléphone', key: 'phone', width: 18 },
      { header: 'Département', key: 'departement', width: 22 },
      { header: 'Commercial', key: 'commercial', width: 26 },
      { header: 'Prospects', key: 'prospects', width: 12 },
      { header: 'Date de saisie', key: 'saisie', width: 20, style: { numFmt: DATE_FORMAT } },
    ];
    styleHeader(repSheet);
    repSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 6 } };
    writeDemoWarningRow(repSheet, demoEnabled, 6);
    for (const representant of [...representants.values()].sort(
      (left, right) => right.prospects - left.prospects,
    )) {
      repSheet
        .addRow({
          fullName: representant.fullName,
          phone: representant.phoneE164,
          departement: representant.departement,
          commercial: representant.commercial,
          prospects: representant.prospects,
          saisie: representant.clientCreatedAt,
        })
        .commit();
    }
    repSheet.commit();

    const [totals, byBanque, bySyndicat, byDepartement, bySegment, byStatus, byMethod] =
      await Promise.all([
        this.analytics.totals(user, filter),
        this.analytics.byBanque(user, filter),
        this.analytics.bySyndicat(user, filter),
        this.analytics.byDepartement(user, filter),
        this.analytics.bySegment(user, filter),
        this.analytics.byPhase2Status(user, filter),
        this.analytics.byEnrollmentMethod(user, filter),
      ]);

    const summary = workbook.addWorksheet('Synthèse');
    summary.columns = [
      { header: 'Indicateur', key: 'label', width: 34 },
      { header: 'Valeur', key: 'value', width: 16 },
      { header: 'Part (%)', key: 'share', width: 12 },
    ];
    styleHeader(summary);
    writeDemoWarningRow(summary, demoEnabled, 3);

    const addSection = (title: string): void => {
      const row = summary.addRow({ label: title });
      row.font = { bold: true, color: { argb: CPI_BURGUNDY } };
      row.commit();
    };

    addSection('Vue d’ensemble');
    summary.addRow({ label: 'Prospects exportés', value: total }).commit();
    summary.addRow({ label: 'Représentants distincts', value: representants.size }).commit();
    summary.addRow({ label: 'Commerciaux actifs', value: totals.commerciauxActifs }).commit();
    summary.addRow({ label: 'Départements couverts', value: totals.departementsCouverts }).commit();
    summary.addRow({ label: 'Nouveaux', value: totals.nouveau }).commit();
    summary.addRow({ label: 'Contactés', value: totals.contacte }).commit();
    summary.addRow({ label: 'Convertis', value: totals.converti }).commit();
    summary.addRow({ label: 'Perdus', value: totals.perdu }).commit();
    summary.addRow({ label: 'Saisis sur 7 jours', value: totals.prospects7Jours }).commit();
    summary.addRow({ label: 'Saisis sur 30 jours', value: totals.prospects30Jours }).commit();

    for (const [title, list] of [
      ['Par banque', byBanque],
      ['Par syndicat', bySyndicat],
      ['Par département', byDepartement],
    ] as const) {
      summary.addRow({}).commit();
      addSection(title);
      for (const item of list.items) {
        summary.addRow({ label: item.label, value: item.prospects, share: item.share }).commit();
      }
    }

    summary.addRow({}).commit();
    addSection('Par segment');
    for (const item of bySegment.items) {
      summary.addRow({ label: item.label, value: item.prospects, share: item.share }).commit();
    }

    summary.addRow({}).commit();
    addSection('Avancement phase 2');
    for (const item of byStatus.items) {
      summary.addRow({ label: item.label, value: item.prospects, share: item.share }).commit();
    }

    summary.addRow({}).commit();
    addSection('Méthodes d’enrôlement obtenues');
    for (const item of byMethod.items) {
      summary.addRow({ label: item.label, value: item.prospects, share: item.share }).commit();
    }

    summary.commit();
  }

  /**
   * EXACTEMENT cinq feuilles : Consolidé, puis un onglet par segment, BDD1 à BDD4, chacun
   * repasse par `buildProspectWhere` pour rester la population du graphique de meme nom.
   */
  // Le `segment` du filtre est ignore ici : c'est le classeur qui porte la segmentation.
  private async writeConsolidated(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
    demoEnabled: boolean,
  ): Promise<void> {
    await this.writeProspectSheet(
      workbook,
      CONSOLIDATED_SHEET,
      buildProspectWhere(user, filterForSegment(filter, undefined)),
      demoEnabled,
    );

    for (const segment of ALL_SEGMENTS) {
      await this.writeProspectSheet(
        workbook,
        segment,
        buildProspectWhere(user, filterForSegment(filter, segment)),
        demoEnabled,
      );
    }
  }

  private async writeProspectSheet(
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
    name: string,
    where: Prisma.ProspectWhereInput,
    demoEnabled: boolean,
  ): Promise<SheetResult> {
    // Page lue AVANT de creer la feuille : les largeurs tiennent dans l'en-tete du XML et
    // ne sont plus ajustables une fois des lignes emises.
    let page = await this.page(where, undefined);
    let attempts = await this.attempts(page);
    const widths = computeWidths(page, attempts);

    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = PROSPECT_COLUMNS.map((column, index) => ({
      header: column.header,
      key: column.key,
      width: widths[index] ?? 16,
      ...(column.isDate ? { style: { numFmt: DATE_FORMAT } } : {}),
    }));
    styleHeader(sheet);
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: PROSPECT_COLUMNS.length },
    };
    writeDemoWarningRow(sheet, demoEnabled, PROSPECT_COLUMNS.length);

    const representants = new Map<string, RepresentantTally>();
    let rows = 0;

    while (page.length) {
      for (const row of page) {
        const last = attempts.get(row.id);
        sheet
          .addRow(Object.fromEntries(PROSPECT_COLUMNS.map((c) => [c.key, cellValue(c, row, last)])))
          .commit();
        rows += 1;

        // Une fiche sans representant ne peuple pas l'onglet Representants : il
        // n'y a personne a y nommer. Elle reste comptee dans l'onglet Prospects.
        const representant = row.representant;
        if (representant) {
          const known = representants.get(representant.id);
          if (known) known.prospects += 1;
          else {
            representants.set(representant.id, {
              fullName: representant.fullName,
              phoneE164: representant.phoneE164,
              departement: representant.departement.name,
              commercial: representant.createdBy.fullName,
              clientCreatedAt: representant.clientCreatedAt,
              prospects: 1,
            });
          }
        }
      }
      if (page.length < PAGE_SIZE) break;
      page = await this.page(where, page.at(-1)?.id);
      attempts = await this.attempts(page);
    }
    sheet.commit();

    return { rows, representants };
  }

  /** Keyset sur l'identifiant : stable meme si des lignes changent pendant l'export. */
  private page(
    where: Prisma.ProspectWhereInput,
    afterId: string | undefined,
  ): Promise<ExportRow[]> {
    return this.prisma.prospect.findMany({
      where: afterId ? { AND: [where, { id: { gt: afterId } }] } : where,
      include: EXPORT_INCLUDE,
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
    });
  }

  /** Toute la page en UNE requete : une lecture par ligne ne finirait jamais sur 500 000 lignes. */
  private attempts(page: readonly ExportRow[]): Promise<Map<string, LastAttempt>> {
    return lastAttemptsByProspect(
      this.prisma,
      page.map((row) => row.id),
    );
  }
}

// `Object.assign` et non la diffusion : le filtre est une instance de classe, `...` perdrait son prototype.
function filterForSegment(
  filter: ProspectFilterDto,
  segment: BddSegment | undefined,
): ProspectFilterDto {
  const copy = Object.assign({}, filter);
  if (segment) copy.segment = segment;
  else delete copy.segment;
  return copy;
}

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CPI_BURGUNDY } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  header.height = 22;
  header.commit();
}

function computeWidths(sample: readonly ExportRow[], attempts: Map<string, LastAttempt>): number[] {
  return PROSPECT_COLUMNS.map((column) => {
    let longest = column.header.length;
    for (const row of sample) {
      const value = column.value(row, attempts.get(row.id));
      const length = value instanceof Date ? 19 : String(value).length;
      if (length > longest) longest = length;
    }
    return Math.min(longest + 2, MAX_COLUMN_WIDTH);
  });
}
