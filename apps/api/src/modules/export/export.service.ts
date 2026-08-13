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
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';

/** Bordeaux CPI. ARGB, sans le dièse : exceljs n'accepte pas la notation CSS. */
const CPI_BURGUNDY = 'FF630210';

/** Taille de page de lecture. Borne la mémoire quel que soit le volume exporté. */
const PAGE_SIZE = 500;

/** Au-delà, une colonne devient illisible ; le texte est simplement tronqué à l'affichage. */
const MAX_COLUMN_WIDTH = 50;

/**
 * Format de date imposé aux colonnes d'horodatage.
 *
 * Sans lui, Excel applique la locale du poste : le même fichier se lit
 * `08/12/2026` à Dakar et `12/08/2026` ailleurs, sur des dates que l'équipe
 * commerciale compare à la main. Les valeurs, elles, sont déjà ramenées à
 * l'heure murale de Dakar par `toDakarCell`.
 */
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
    private readonly demo: DemoVisibilityService,
  ) {}

  /**
   * Écrit le classeur DIRECTEMENT dans le flux de réponse.
   *
   * `WorkbookWriter` émet le XML au fil de l'eau : le fichier complet n'est
   * jamais matérialisé en mémoire. Sur un export de plusieurs centaines de
   * milliers de prospects, la variante `Workbook` classique tiendrait tout le
   * classeur en RAM et ferait tomber le conteneur.
   *
   * La lecture est paginée par keyset sur l'identifiant, pour la même raison :
   * à aucun instant plus de `PAGE_SIZE` lignes ne coexistent côté Node.
   */
  async writeProspects(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
    stream: Writable,
    mode: ExportMode = ExportMode.FILTERED,
  ): Promise<void> {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true });
    workbook.creator = 'CPI GO';
    workbook.created = new Date();

    if (mode === ExportMode.CONSOLIDATED) {
      await this.writeConsolidated(user, filter, workbook);
    } else {
      await this.writeFiltered(user, filter, workbook);
    }

    await workbook.commit();
  }

  /**
   * Vue filtrée : une feuille de prospects correspondant EXACTEMENT au filtre
   * reçu, plus les deux feuilles d'accompagnement historiques.
   */
  private async writeFiltered(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  ): Promise<void> {
    const where = buildProspectWhere(user, filter, await this.demo.enabled());
    const { rows: total, representants } = await this.writeProspectSheet(
      workbook,
      'Prospects',
      where,
    );

    // ─ Feuille Représentants ─
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

    // ─ Feuille Synthèse ─
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
   * Classeur consolidé : EXACTEMENT cinq feuilles.
   *
   * Chaque feuille de segment est produite par une passe distincte dont le
   * `where` sort de `buildProspectWhere`, donc de `segmentWhere`. Aucune
   * répartition des lignes n'est faite en mémoire : trier côté Node imposerait
   * de retenir les quatre populations à la fois, ce que 500 000 lignes
   * interdisent, et surtout ferait exister une SECONDE implémentation de la
   * segmentation, qui divergerait de la première au premier ajustement.
   *
   * Un `segment` reçu en paramètre est délibérément ignoré : c'est le classeur
   * qui porte la segmentation. L'honorer viderait trois onglets sur quatre tout
   * en les laissant s'afficher, ce qui se lit comme une base vide.
   */
  private async writeConsolidated(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  ): Promise<void> {
    // Lu UNE fois pour tout le classeur. Relire à chaque feuille laisserait une
    // bascule survenue en cours d'export produire un fichier incohérent : un
    // onglet consolidé sans les fiches de démonstration et un onglet BDD3 avec.
    // Personne ne pourrait expliquer l'écart en relisant le fichier.
    const demoEnabled = await this.demo.enabled();

    await this.writeProspectSheet(
      workbook,
      CONSOLIDATED_SHEET,
      buildProspectWhere(user, filterForSegment(filter, undefined), demoEnabled),
    );

    for (const segment of ALL_SEGMENTS) {
      await this.writeProspectSheet(
        workbook,
        segment,
        buildProspectWhere(user, filterForSegment(filter, segment), demoEnabled),
      );
    }
  }

  /** Une feuille de prospects, écrite au fil de l'eau. */
  private async writeProspectSheet(
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
    name: string,
    where: Prisma.ProspectWhereInput,
  ): Promise<SheetResult> {
    // Première page lue AVANT de créer la feuille : les largeurs de colonnes
    // font partie de l'en-tête du XML et ne peuvent plus être ajustées une fois
    // les lignes émises. On les calibre donc sur un échantillon réel.
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

    const representants = new Map<string, RepresentantTally>();
    let rows = 0;

    while (page.length) {
      for (const row of page) {
        const last = attempts.get(row.id);
        sheet
          .addRow(Object.fromEntries(PROSPECT_COLUMNS.map((c) => [c.key, cellValue(c, row, last)])))
          .commit();
        rows += 1;

        const known = representants.get(row.representant.id);
        if (known) known.prospects += 1;
        else {
          representants.set(row.representant.id, {
            fullName: row.representant.fullName,
            phoneE164: row.representant.phoneE164,
            departement: row.representant.departement.name,
            commercial: row.representant.createdBy.fullName,
            clientCreatedAt: row.representant.clientCreatedAt,
            prospects: 1,
          });
        }
      }
      if (page.length < PAGE_SIZE) break;
      page = await this.page(where, page.at(-1)?.id);
      attempts = await this.attempts(page);
    }
    sheet.commit();

    return { rows, representants };
  }

  /** Pagination keyset sur l'identifiant : stable même si des lignes changent pendant l'export. */
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

  /**
   * Dernière tentative d'appel de toute la page, en une requête.
   *
   * Une lecture par ligne coûterait ici un aller-retour par prospect exporté :
   * sur 500 000 lignes, l'export ne se terminerait jamais.
   */
  private attempts(page: readonly ExportRow[]): Promise<Map<string, LastAttempt>> {
    return lastAttemptsByProspect(
      this.prisma,
      page.map((row) => row.id),
    );
  }
}

/**
 * Le filtre reçu, réécrit sur un segment donné — ou débarrassé du sien.
 *
 * `Object.assign` plutôt que l'opérateur de diffusion : le filtre est une
 * instance de classe, et la diffuser en perdrait le prototype. Sans conséquence
 * ici puisque le DTO ne porte aucune méthode, mais une copie explicite dit
 * mieux ce qui se passe qu'un `...` qui ressemble à une copie de valeur.
 */
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

/** Largeur = le plus long entre l'en-tête et l'échantillon, avec une marge de 2. */
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
