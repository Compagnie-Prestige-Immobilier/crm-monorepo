import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  CallOutcome,
  LotExportCible,
  Prisma,
  Projet,
  RepCallOutcome,
  Role,
  StatutQualificationEffect,
  SuggestionStatus,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { Writable } from 'node:stream';
import { PassThrough } from 'node:stream';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildProspectWhere } from '../../common/prospect-where.js';
import { isAdmin } from '../../common/scope.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { RepresentantExportQueryDto } from '../representants/dto.js';
import { suiviWhere } from '../representants/representants.service.js';
import { EXPORT_INCLUDE, PROSPECT_COLUMNS, cellValue } from '../export/columns.js';
import { markWorkbook, writeDemoWarningRow } from '../export/demo-marking.js';
import { styleHeader } from '../export/import-template.workbook.js';
import { toDakarCell } from '../export/dakar.js';
import { lastAttemptsByProspect } from '../prospects/last-attempt.js';
import { CALL_OUTCOME_LABELS } from '../prospects/phase2-labels.js';
import { WorkspaceContext } from '../../workspaces/workspace.js';
import { capaciteParJour, repartir, type MembreRepartition } from './repartition.js';
import { programmeFilename, writeProgrammePdf, type ProgrammeData } from './programme-pdf.js';
import {
  CreateLotExportDto,
  LotExportAttemptDto,
  LotExportDetailDto,
  LotExportFicheDto,
  LotExportFicheEtat,
  LotExportFichesDto,
  LotExportFichesQueryDto,
  LotExportListDto,
  LotExportObjectifDto,
  LotExportPerformanceDto,
  LotExportPreviewDto,
  LotExportQueryDto,
  LotExportReaffectationDto,
  LotExportRepartitionDto,
  LotExportSummaryDto,
  MesAttributionsDto,
  ReaffecterLotExportDto,
  RetirerTeleconseillerDto,
  UpdateLotExportDto,
} from './dto.js';

const ADMIN = { id: 'admin', role: Role.ADMIN } as const;
const CHUNK = 5_000;
const DETAIL_PAGE = 500;
const DATE_FORMAT = 'dd/mm/yyyy hh:mm';
const TELECONSEILLER_ROLES = [Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION];

/** Trois cibles tirent des représentants ; seule `PROSPECTS` tire des prospects. */
const CIBLES_REPRESENTANTS: readonly LotExportCible[] = [
  LotExportCible.REPRESENTANTS,
  LotExportCible.REPRESENTANTS_INJOIGNABLES,
  LotExportCible.CONTACTS_RECOMMANDES,
];

const surRepresentants = (cible: LotExportCible): boolean => CIBLES_REPRESENTANTS.includes(cible);

type LotExportRow = Prisma.LotExportGetPayload<{
  include: { createdBy: { select: { fullName: true } } };
}>;

interface Teleconseiller {
  readonly id: string;
  readonly fullName: string;
  readonly role: Role;
}

interface Distribution {
  readonly teleconseillerIds: string[];
  readonly fichesParJour: number;
  readonly jours: number;
  /** EB-17 : l'objectif propre à un téléconseiller. Absent, le rôle décide. */
  readonly objectifs: Readonly<Record<string, number>>;
}

interface ItemRow {
  readonly position: number;
  readonly day: number;
  readonly assigneeId: string | null;
  readonly prospectId: string | null;
  readonly representantId: string | null;
  readonly assignee: { readonly fullName: string } | null;
}

interface PerformanceRow {
  id: string;
  name: string;
  assigned: number;
  treated: number;
  assignedCalls: number;
  outsideAssignmentCalls: number;
}

@Injectable()
export class LotsExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: WorkspaceContext,
  ) {}

  async preview(body: CreateLotExportDto): Promise<LotExportPreviewDto> {
    const equipe = await this.equipe(body.distribution.teleconseillerIds);
    const membres = capacites(
      equipe,
      body.distribution.fichesParJour,
      objectifsDe(body.distribution.objectifs),
    );
    const places = placesDe(membres, body.distribution.jours);
    const eligible = await this.compter(body);
    const retenues = Math.min(eligible, places);
    return {
      eligible,
      scopeLabel: scopeLabel(body.cible, body.representants ?? body.prospects ?? {}),
      places,
      retenues,
      parTeleconseiller: Math.ceil(retenues / equipe.length),
    };
  }

  async create(user: AuthenticatedUser, body: CreateLotExportDto): Promise<LotExportSummaryDto> {
    const filters = surRepresentants(body.cible) ? body.representants : body.prospects;
    if (!filters)
      throw new UnprocessableEntityException({
        code: 'LOT_EXPORT_FILTRES_REQUIS',
        message: 'Les critères de la cible sont requis.',
      });
    const equipe = await this.equipe(body.distribution.teleconseillerIds);
    const { fichesParJour, jours } = body.distribution;
    const objectifs = objectifsDe(body.distribution.objectifs);
    const membres = capacites(equipe, fichesParJour, objectifs);
    const places = placesDe(membres, jours);

    const id = await this.prisma.$transaction(
      async (tx) => {
        const fiches = await this.tirer(tx, user, body, places);
        if (!fiches.length)
          throw new UnprocessableEntityException({
            code: 'LOT_EXPORT_CIBLE_VIDE',
            message: 'Aucune fiche ne correspond à cette cible.',
          });

        const affectations = repartir(fiches.length, membres, jours);
        const lot = await tx.lotExport.create({
          data: {
            name: body.name.trim(),
            cible: body.cible,
            // Un représentant est CHUES par construction ; un lot de prospects
            // porte le projet exigé à la création.
            projet:
              surRepresentants(body.cible)
                ? Projet.CHUES
                : (body.prospects?.projet ?? Projet.CHUES),
            // La répartition voyage avec les critères : elle n'a pas de colonne,
            // et un téléconseiller à zéro fiche ne laisse aucune ligne derrière lui.
            filters: {
              ...(filters as Record<string, unknown>),
              distribution: {
                teleconseillerIds: equipe.map((membre) => membre.id),
                fichesParJour,
                jours,
                objectifs,
              },
            } as Prisma.InputJsonValue,
            itemCount: affectations.length,
            createdById: user.id,
          },
        });
        for (let start = 0; start < affectations.length; start += CHUNK)
          await tx.lotExportItem.createMany({
            data: affectations.slice(start, start + CHUNK).map((affectation, index) => {
              const fiche = fiches[start + index];
              if (!fiche) throw new Error('Fiche absente de la répartition');
              return {
                lotId: lot.id,
                position: start + index,
                assigneeId: affectation.assigneeId,
                day: affectation.day,
                ...(surRepresentants(body.cible)
                  ? { representantId: fiche.id }
                  : { prospectId: fiche.id }),
              };
            }),
          });
        return lot.id;
      },
      { timeout: 120_000, maxWait: 15_000 },
    );
    return this.summary(id);
  }

  async list(query: LotExportQueryDto): Promise<LotExportListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: Prisma.LotExportWhereInput = {
      ...(query.search ? { name: { contains: query.search.trim(), mode: 'insensitive' } } : {}),
      ...(query.cible ? { cible: query.cible } : {}),
      ...(query.projet ? { projet: query.projet } : {}),
      ...(query.createdById ? { createdById: query.createdById } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.lotExport.count({ where }),
      this.prisma.lotExport.findMany({
        where,
        include: { createdBy: { select: { fullName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: await Promise.all(rows.map((row) => this.summary(row.id, row))),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  /**
   * EB-14 et EB-17 : le nom se corrige, l'objectif de chacun se règle en cours
   * de campagne.
   *
   * Ni l'un ni l'autre ne redistribue quoi que ce soit : les fiches sont déjà
   * dans les mains, et un objectif est le dénominateur du taux de contact, pas
   * un ordre de retirage.
   */
  async update(id: string, body: UpdateLotExportDto): Promise<LotExportSummaryDto> {
    const lot = await this.lot(id);
    const data: Prisma.LotExportUpdateInput = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.objectifs !== undefined)
      data.filters = ecrireLaDistribution(lot.filters, (distribution) => ({
        ...distribution,
        objectifs: objectifsDe(body.objectifs),
      }));
    if (Object.keys(data).length > 0)
      await this.prisma.lotExport.update({ where: { id }, data });
    return this.summary(id);
  }

  /**
   * EB-16 : des fiches NON TRAITÉES passent à un autre téléconseiller.
   *
   * Une fiche déjà appelée reste où elle est : la déplacer ferait porter le
   * travail d'un téléconseiller au compteur d'un autre. Le destinataire entre
   * dans l'équipe de la campagne s'il n'y était pas.
   */
  async reaffecter(
    user: AuthenticatedUser,
    id: string,
    body: ReaffecterLotExportDto,
  ): Promise<LotExportDetailDto> {
    const lot = await this.lot(id);
    await this.equipe([body.versTeleconseillerId]);
    const traitees = await this.positionsTraitees(lot);

    const deplacables = await this.prisma.lotExportItem.findMany({
      where: {
        lotId: id,
        position: { in: body.positions.filter((position) => !traitees.has(position)) },
        assigneeId: { not: body.versTeleconseillerId },
      },
      select: { position: true, assigneeId: true },
    });
    if (deplacables.length === 0)
      throw new UnprocessableEntityException({
        code: 'LOT_EXPORT_REAFFECTATION_VIDE',
        message: 'Aucune de ces fiches n’est déplaçable : elles sont traitées, ou déjà à ce compte.',
      });

    await this.deplacer(user, lot, deplacables, body.versTeleconseillerId);
    return this.get(id);
  }

  /**
   * EB-16 : le retiré rend ses fiches non traitées, redistribuées au reste de
   * l'équipe selon les objectifs en vigueur.
   */
  async retirer(
    user: AuthenticatedUser,
    id: string,
    body: RetirerTeleconseillerDto,
  ): Promise<LotExportDetailDto> {
    const lot = await this.lot(id);
    const stored = readDistribution(lot.filters);
    const restants = (stored?.teleconseillerIds ?? []).filter(
      (membre) => membre !== body.teleconseillerId,
    );
    if (restants.length === 0)
      throw new UnprocessableEntityException({
        code: 'LOT_EXPORT_EQUIPE_VIDE',
        message: 'Une campagne garde au moins un téléconseiller.',
      });

    const traitees = await this.positionsTraitees(lot);
    const arendre = (
      await this.prisma.lotExportItem.findMany({
        where: { lotId: id, assigneeId: body.teleconseillerId },
        select: { position: true },
        orderBy: { position: 'asc' },
      })
    ).filter((item) => !traitees.has(item.position));

    const equipe = await this.equipe(restants);
    const membres = capacites(equipe, stored?.fichesParJour ?? 1, stored?.objectifs ?? {});
    const reprises = repartir(arendre.length, membres, stored?.jours ?? 1);

    await this.prisma.$transaction(async (tx) => {
      const parRepreneur = new Map<string, number[]>();
      arendre.forEach((item, index) => {
        const vers = reprises[index]?.assigneeId;
        if (vers === undefined) return;
        parRepreneur.set(vers, [...(parRepreneur.get(vers) ?? []), item.position]);
      });
      for (const [vers, positions] of parRepreneur) {
        await tx.lotExportItem.updateMany({
          where: { lotId: id, position: { in: positions } },
          data: { assigneeId: vers },
        });
        await tx.lotExportReaffectation.create({
          data: {
            lotId: id,
            fromAssigneeId: body.teleconseillerId,
            toAssigneeId: vers,
            fiches: positions.length,
            performedById: user.id,
          },
        });
      }
      await tx.lotExport.update({
        where: { id },
        data: {
          filters: ecrireLaDistribution(lot.filters, (distribution) => ({
            ...distribution,
            teleconseillerIds: restants,
          })),
        },
      });
    });
    return this.get(id);
  }

  private async deplacer(
    user: AuthenticatedUser,
    lot: { id: string; filters: Prisma.JsonValue },
    items: readonly { position: number; assigneeId: string | null }[],
    vers: string,
  ): Promise<void> {
    const parCedant = new Map<string | null, number[]>();
    for (const item of items)
      parCedant.set(item.assigneeId, [...(parCedant.get(item.assigneeId) ?? []), item.position]);

    await this.prisma.$transaction(async (tx) => {
      await tx.lotExportItem.updateMany({
        where: { lotId: lot.id, position: { in: items.map((item) => item.position) } },
        data: { assigneeId: vers },
      });
      for (const [cedant, positions] of parCedant)
        await tx.lotExportReaffectation.create({
          data: {
            lotId: lot.id,
            fromAssigneeId: cedant,
            toAssigneeId: vers,
            fiches: positions.length,
            performedById: user.id,
          },
        });
      await tx.lotExport.update({
        where: { id: lot.id },
        data: {
          filters: ecrireLaDistribution(lot.filters, (distribution) => ({
            ...distribution,
            teleconseillerIds: distribution.teleconseillerIds.includes(vers)
              ? distribution.teleconseillerIds
              : [...distribution.teleconseillerIds, vers],
          })),
        },
      });
    });
  }

  /**
   * Supprime une campagne et sa répartition.
   *
   * Les fiches ne bougent pas : `LotExportItem` cascade sur le lot, mais ses
   * relations vers le représentant et le prospect ne sont que des pointeurs. Un
   * lot est un tirage imprimé, pas un propriétaire. Les appels qui ont suivi
   * vivent dans `RepCallAttempt`, sans lien avec le lot : les effacer avec lui
   * effacerait le travail des téléconseillers.
   */
  async remove(id: string): Promise<void> {
    const { count } = await this.prisma.lotExport.deleteMany({ where: { id } });
    if (count === 0)
      throw new NotFoundException({
        code: 'LOT_EXPORT_NOT_FOUND',
        message: 'Campagne introuvable.',
      });
  }

  /**
   * Ce que l'appelant a le droit d'appeler, pour que le téléphone filtre son
   * propre tirage : le pull reste global, c'est ici que se dit le périmètre.
   *
   * Un item ne porte qu'une des deux clés ; le filtre de relation écarte donc
   * seul les fiches supprimées, sans qu'un `deletedAt` traîne côté item.
   */
  async mesAttributions(user: AuthenticatedUser): Promise<MesAttributionsDto> {
    if (isAdmin(user)) return { representantIds: [], prospectIds: [], tout: true };

    const [representants, prospects] = await Promise.all([
      this.prisma.lotExportItem.findMany({
        where: { assigneeId: user.id, representant: { deletedAt: null } },
        select: { representantId: true },
        distinct: ['representantId'],
      }),
      this.prisma.lotExportItem.findMany({
        where: { assigneeId: user.id, prospect: { deletedAt: null } },
        select: { prospectId: true },
        distinct: ['prospectId'],
      }),
    ]);

    return {
      representantIds: representants.flatMap((item) => item.representantId ?? []),
      prospectIds: prospects.flatMap((item) => item.prospectId ?? []),
      tout: false,
    };
  }

  async get(id: string): Promise<LotExportDetailDto> {
    const row = await this.prisma.lotExport.findUnique({
      where: { id },
      include: { createdBy: { select: { fullName: true } } },
    });
    if (!row)
      throw new NotFoundException({
        code: 'LOT_EXPORT_NOT_FOUND',
        message: 'Campagne introuvable.',
      });

    const groupes = await this.prisma.lotExportItem.groupBy({
      by: ['assigneeId', 'day'],
      where: { lotId: id },
      _count: { _all: true },
      _min: { position: true },
    });
    const stored = readDistribution(row.filters);
    const ordre = stored?.teleconseillerIds ?? [
      ...new Set(
        [...groupes]
          .sort((left, right) => (left._min.position ?? 0) - (right._min.position ?? 0))
          .flatMap((groupe) => (groupe.assigneeId === null ? [] : [groupe.assigneeId])),
      ),
    ];
    const jours = stored?.jours ?? Math.max(1, ...groupes.map((groupe) => groupe.day));
    const fichesParJour =
      stored?.fichesParJour ?? Math.max(1, ...groupes.map((groupe) => groupe._count._all));
    const noms = new Map(
      (
        await this.prisma.user.findMany({
          where: { id: { in: ordre } },
          select: { id: true, fullName: true },
        })
      ).map((membre) => [membre.id, membre.fullName]),
    );
    const compte = new Map(
      groupes.map((groupe) => [
        `${groupe.assigneeId ?? ''}#${String(groupe.day)}`,
        groupe._count._all,
      ]),
    );
    const repartition: LotExportRepartitionDto[] = ordre.map((teleconseillerId) => ({
      teleconseillerId,
      teleconseillerName: noms.get(teleconseillerId) ?? 'Compte supprimé',
      jours: Array.from({ length: jours }, (_, index) => ({
        jour: index + 1,
        fiches: compte.get(`${teleconseillerId}#${String(index + 1)}`) ?? 0,
      })),
    }));

    return Object.assign(await this.summary(id, row), {
      callsByTeleconseiller: await this.callsByUser(row.id, row.cible, row.createdAt),
      recentAttempts: await this.recentAttempts(row.id, row.cible, row.createdAt),
      distribution: { fichesParJour, jours },
      repartition,
      performance: await this.performance(row.id, row.cible, row.createdAt, stored),
      reaffectations: await this.reaffectations(row.id),
    });
  }

  private async reaffectations(id: string): Promise<LotExportReaffectationDto[]> {
    const rows = await this.prisma.lotExportReaffectation.findMany({
      where: { lotId: id },
      include: {
        fromAssignee: { select: { fullName: true } },
        toAssignee: { select: { fullName: true } },
        performedBy: { select: { fullName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      fromName: row.fromAssignee?.fullName ?? null,
      toName: row.toAssignee.fullName,
      fiches: row.fiches,
      performedByName: row.performedBy.fullName,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** Le classeur du lot : la répartition d'abord, la fiche ensuite. */
  async writeXlsx(id: string, stream: Writable): Promise<void> {
    const lot = await this.prisma.lotExport.findUnique({
      where: { id },
      select: { cible: true, filters: true },
    });
    if (!lot)
      throw new NotFoundException({
        code: 'LOT_EXPORT_NOT_FOUND',
        message: 'Campagne introuvable.',
      });

    const items = await this.prisma.lotExportItem.findMany({
      where: { lotId: id },
      orderBy: { position: 'asc' },
      select: {
        position: true,
        day: true,
        assigneeId: true,
        prospectId: true,
        representantId: true,
        assignee: { select: { fullName: true } },
      },
    });
    const ordonnes = trierParTeleconseiller(items, readDistribution(lot.filters));

    const demoEnabled = this.demo.current() === 'demo';
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true });
    markWorkbook(workbook, demoEnabled);
    if (surRepresentants(lot.cible))
      await this.writeRepresentantsSheet(workbook, ordonnes, demoEnabled);
    else await this.writeProspectsSheet(workbook, ordonnes, demoEnabled);
    await workbook.commit();
  }

  writeProgramme(data: ProgrammeData, stream: Writable): Promise<void> {
    return writeProgrammePdf(stream, data);
  }

  /** Rendue AVANT que la réponse ne soit détournée : après, un 404 ne partirait plus. */
  async programmesZip(id: string): Promise<Buffer> {
    const paires = await this.prisma.lotExportItem.groupBy({
      by: ['assigneeId', 'day'],
      where: { lotId: id, assigneeId: { not: null } },
      _min: { position: true },
    });
    if (!paires.length)
      throw new NotFoundException({
        code: 'LOT_EXPORT_PROGRAMME_INTROUVABLE',
        message: 'Cette campagne ne porte aucun programme.',
      });

    const zip = new JSZip();
    const ordonnees = [...paires].sort(
      (left, right) =>
        (left._min.position ?? 0) - (right._min.position ?? 0) || left.day - right.day,
    );
    for (const paire of ordonnees) {
      if (paire.assigneeId === null) continue;
      const data = await this.programme(id, paire.assigneeId, paire.day);
      const nom = programmeFilename(data);
      zip.file(zip.file(nom) ? `${paire.assigneeId}-${nom}` : nom, await this.pdfBuffer(data));
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  async programme(id: string, teleconseillerId: string, jour: number): Promise<ProgrammeData> {
    const lot = await this.prisma.lotExport.findUnique({
      where: { id },
      select: { name: true, cible: true, filters: true },
    });
    if (!lot)
      throw new NotFoundException({
        code: 'LOT_EXPORT_NOT_FOUND',
        message: 'Campagne introuvable.',
      });

    const items = await this.prisma.lotExportItem.findMany({
      where: { lotId: id, assigneeId: teleconseillerId, day: jour },
      orderBy: { position: 'asc' },
      select: {
        assignee: { select: { fullName: true } },
        representant: { select: { fullName: true, etablissement: true, phoneE164: true } },
        prospect: { select: { nom: true, prenom: true, phoneE164: true } },
      },
    });
    if (!items.length)
      throw new NotFoundException({
        code: 'LOT_EXPORT_PROGRAMME_INTROUVABLE',
        message: 'Aucune fiche pour ce téléconseiller à cette journée.',
      });

    const stored = readDistribution(lot.filters);
    const dayCount =
      stored?.jours ??
      (
        await this.prisma.lotExportItem.aggregate({
          where: { lotId: id },
          _max: { day: true },
        })
      )._max.day ??
      1;
    const label = scopeLabel(lot.cible, lot.filters);
    return {
      teleconseillerName: items[0]?.assignee?.fullName ?? 'Téléconseiller',
      dayNumber: jour,
      dayCount,
      lotName: lot.name,
      cibleLabel: surRepresentants(lot.cible) ? label : `Prospects : ${label}`,
      generatedAt: new Date(),
      rows: items.map((item, index) => ({
        position: index + 1,
        fullName:
          item.representant?.fullName ??
          [item.prospect?.nom, item.prospect?.prenom].filter(Boolean).join(' '),
        etablissement: item.representant?.etablissement ?? '',
        phoneE164: item.representant?.phoneE164 ?? item.prospect?.phoneE164 ?? '',
      })),
    };
  }

  private async pdfBuffer(data: ProgrammeData): Promise<Buffer> {
    const out = new PassThrough();
    const chunks: Buffer[] = [];
    out.on('data', (chunk: Buffer) => chunks.push(chunk));
    await writeProgrammePdf(out, data);
    return Buffer.concat(chunks);
  }

  private async writeProspectsSheet(
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
    items: readonly ItemRow[],
    demoEnabled: boolean,
  ): Promise<void> {
    const sheet = workbook.addWorksheet('Répartition', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      ...REPARTITION_COLUMNS,
      ...PROSPECT_COLUMNS.map((column) => ({
        header: column.header,
        key: column.key,
        width: 22,
        ...(column.isDate ? { style: { numFmt: DATE_FORMAT } } : {}),
      })),
    ];
    styleHeader(sheet, sheet.columns.length);
    writeDemoWarningRow(sheet, demoEnabled, sheet.columns.length);

    for (let start = 0; start < items.length; start += DETAIL_PAGE) {
      const page = items.slice(start, start + DETAIL_PAGE);
      const ids = page.flatMap((item) => (item.prospectId ? [item.prospectId] : []));
      const rows = await this.prisma.prospect.findMany({
        where: { id: { in: ids } },
        include: EXPORT_INCLUDE,
      });
      const attempts = await lastAttemptsByProspect(this.prisma, ids);
      const byId = new Map(rows.map((row) => [row.id, row]));
      for (const item of page) {
        const row = item.prospectId ? byId.get(item.prospectId) : undefined;
        if (!row) continue;
        sheet
          .addRow({
            teleconseiller: item.assignee?.fullName ?? '',
            jour: item.day,
            ...Object.fromEntries(
              PROSPECT_COLUMNS.map((column) => [
                column.key,
                cellValue(column, row, attempts.get(row.id)),
              ]),
            ),
          })
          .commit();
      }
    }
    sheet.commit();
  }

  private async writeRepresentantsSheet(
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
    items: readonly ItemRow[],
    demoEnabled: boolean,
  ): Promise<void> {
    const sheet = workbook.addWorksheet('Répartition', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      ...REPARTITION_COLUMNS,
      { header: 'Nom complet', key: 'fullName', width: 30 },
      { header: 'Téléphone', key: 'phone', width: 20 },
      { header: 'Département', key: 'departement', width: 24 },
      { header: 'IEF', key: 'ief', width: 26 },
      { header: 'Commercial', key: 'commercial', width: 26 },
      { header: 'Notes', key: 'notes', width: 40 },
      { header: 'Saisi le', key: 'clientCreatedAt', width: 20, style: { numFmt: DATE_FORMAT } },
    ];
    styleHeader(sheet, sheet.columns.length);
    writeDemoWarningRow(sheet, demoEnabled, sheet.columns.length);

    for (let start = 0; start < items.length; start += DETAIL_PAGE) {
      const page = items.slice(start, start + DETAIL_PAGE);
      const ids = page.flatMap((item) => (item.representantId ? [item.representantId] : []));
      const rows = await this.prisma.representant.findMany({
        where: { id: { in: ids } },
        include: {
          departement: { select: { name: true } },
          ief: { select: { name: true } },
          createdBy: { select: { fullName: true } },
        },
      });
      const byId = new Map(rows.map((row) => [row.id, row]));
      for (const item of page) {
        const row = item.representantId ? byId.get(item.representantId) : undefined;
        if (!row) continue;
        sheet
          .addRow({
            teleconseiller: item.assignee?.fullName ?? '',
            jour: item.day,
            fullName: row.fullName,
            phone: row.phoneE164,
            departement: row.departement.name,
            ief: row.ief?.name ?? '',
            commercial: row.createdBy.fullName,
            notes: row.notes ?? '',
            clientCreatedAt: toDakarCell(row.clientCreatedAt),
          })
          .commit();
      }
    }
    sheet.commit();
  }

  /** Les comptes cochés, dans l'ordre reçu : cet ordre EST le tourniquet. */
  private async equipe(ids: readonly string[]): Promise<Teleconseiller[]> {
    const uniques = new Set(ids);
    const rows = await this.prisma.user.findMany({
      where: {
        id: { in: [...uniques] },
        isActive: true,
        deletedAt: null,
        role: { in: TELECONSEILLER_ROLES },
      },
      select: { id: true, fullName: true, role: true },
    });
    if (uniques.size !== ids.length || rows.length !== uniques.size)
      throw new UnprocessableEntityException({
        code: 'LOT_EXPORT_TELECONSEILLER_INVALIDE',
        message:
          'Chaque téléconseiller doit être un compte actif et distinct de téléconseil, supervision ou direction.',
      });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => {
      const row = byId.get(id);
      if (!row) throw new Error('Téléconseiller absent de la sélection');
      return row;
    });
  }

  private async summary(id: string, row?: LotExportRow): Promise<LotExportSummaryDto> {
    const lot =
      row ??
      (await this.prisma.lotExport.findUnique({
        where: { id },
        include: { createdBy: { select: { fullName: true } } },
      }));
    if (!lot)
      throw new NotFoundException({
        code: 'LOT_EXPORT_NOT_FOUND',
        message: 'Campagne introuvable.',
      });
    const stats = await this.stats(lot.id, lot.cible, lot.createdAt);
    return {
      id: lot.id,
      name: lot.name,
      cible: lot.cible,
      projet: lot.projet,
      scopeLabel: scopeLabel(lot.cible, lot.filters),
      itemCount: lot.itemCount,
      createdById: lot.createdById,
      createdByName: lot.createdBy.fullName,
      createdAt: lot.createdAt.toISOString(),
      callsSince: stats.calls,
      fichesAppelees: stats.fiches,
    };
  }

  private async stats(
    id: string,
    cible: LotExportCible,
    createdAt: Date,
  ): Promise<{ calls: number; fiches: number }> {
    const [row] =
      surRepresentants(cible)
        ? await this.prisma.$queryRaw<
            { calls: number; fiches: number }[]
          >`SELECT COUNT(*)::int AS calls, COUNT(DISTINCT a."representantId")::int AS fiches FROM "lot_export_items" i INNER JOIN "rep_call_attempts" a ON a."representantId" = i."representantId" WHERE i."lotId" = ${id} AND a."clientCreatedAt" >= ${createdAt}`
        : await this.prisma.$queryRaw<
            { calls: number; fiches: number }[]
          >`SELECT COUNT(*)::int AS calls, COUNT(DISTINCT a."prospectId")::int AS fiches FROM "lot_export_items" i INNER JOIN "call_attempts" a ON a."prospectId" = i."prospectId" WHERE i."lotId" = ${id} AND a."clientCreatedAt" >= ${createdAt}`;
    return row ?? { calls: 0, fiches: 0 };
  }

  private async recentAttempts(
    id: string,
    cible: LotExportCible,
    createdAt: Date,
  ): Promise<LotExportAttemptDto[]> {
    if (surRepresentants(cible)) {
      const rows = await this.prisma.repCallAttempt.findMany({
        where: {
          representant: { lotItems: { some: { lotId: id } } },
          clientCreatedAt: { gte: createdAt },
        },
        include: {
          representant: { select: { phoneE164: true } },
          performedBy: { select: { fullName: true } },
        },
        orderBy: [{ clientCreatedAt: 'desc' }, { id: 'desc' }],
        take: 50,
      });
      return rows.map((row) => ({
        id: row.id,
        phoneE164: row.representant.phoneE164,
        shortCode: '',
        outcome: row.outcome,
        method: null,
        comment: row.comment,
        performedByName: row.performedBy.fullName,
        createdAt: row.createdAt.toISOString(),
        email: null,
        fonctionnaire: null,
        engagementEnCours: null,
        dureeEtablissementMois: null,
        rendezVousAt: null,
      }));
    }
    const rows = await this.prisma.callAttempt.findMany({
      where: {
        prospect: { lotItems: { some: { lotId: id } } },
        clientCreatedAt: { gte: createdAt },
      },
      include: {
        prospect: { select: { phoneE164: true } },
        performedBy: { select: { fullName: true } },
      },
      orderBy: [{ clientCreatedAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      phoneE164: row.prospect.phoneE164,
      shortCode: '',
      outcome: row.outcome,
      method: row.method,
      comment: row.comment,
      performedByName: row.performedBy.fullName,
      createdAt: row.createdAt.toISOString(),
      email: row.email,
      fonctionnaire: row.fonctionnaire,
      engagementEnCours: row.engagementEnCours,
      dureeEtablissementMois: row.dureeEtablissementMois,
      rendezVousAt: row.rendezVousAt?.toISOString() ?? null,
    }));
  }

  private async callsByUser(
    id: string,
    cible: LotExportCible,
    createdAt: Date,
  ): Promise<Record<string, number>> {
    const rows =
      surRepresentants(cible)
        ? await this.prisma.$queryRaw<
            { name: string; calls: number }[]
          >`SELECT u."fullName" AS name, COUNT(*)::int AS calls FROM "rep_call_attempts" a INNER JOIN "lot_export_items" i ON i."representantId" = a."representantId" INNER JOIN "users" u ON u."id" = a."performedById" WHERE i."lotId" = ${id} AND a."clientCreatedAt" >= ${createdAt} GROUP BY u."id", u."fullName"`
        : await this.prisma.$queryRaw<
            { name: string; calls: number }[]
          >`SELECT u."fullName" AS name, COUNT(*)::int AS calls FROM "call_attempts" a INNER JOIN "lot_export_items" i ON i."prospectId" = a."prospectId" INNER JOIN "users" u ON u."id" = a."performedById" WHERE i."lotId" = ${id} AND a."clientCreatedAt" >= ${createdAt} GROUP BY u."id", u."fullName"`;
    return Object.fromEntries(rows.map((row) => [row.name, row.calls]));
  }

  private async performance(
    id: string,
    cible: LotExportCible,
    createdAt: Date,
    distribution: Distribution | null,
  ): Promise<LotExportPerformanceDto[]> {
    const tentatives =
      surRepresentants(cible)
        ? Prisma.sql`SELECT "representantId" AS "targetId", "performedById", "clientCreatedAt" FROM "rep_call_attempts"`
        : Prisma.sql`SELECT "prospectId" AS "targetId", "performedById", "clientCreatedAt" FROM "call_attempts"`;
    const target =
      surRepresentants(cible)
        ? Prisma.sql`i."representantId"`
        : Prisma.sql`i."prospectId"`;

    const rows = await this.prisma.$queryRaw<PerformanceRow[]>`
      WITH tentatives AS (${tentatives}),
      membres AS (
        SELECT
          i."assigneeId" AS id,
          u."fullName" AS name,
          COUNT(*)::int AS assigned
        FROM "lot_export_items" i
        INNER JOIN "users" u ON u.id = i."assigneeId"
        WHERE i."lotId" = ${id} AND i."assigneeId" IS NOT NULL
        GROUP BY i."assigneeId", u."fullName"
      ),
      conformes AS (
        SELECT
          i."assigneeId" AS id,
          COUNT(a."targetId")::int AS "assignedCalls",
          COUNT(DISTINCT i.position)::int AS treated
        FROM "lot_export_items" i
        INNER JOIN tentatives a
          ON a."targetId" = ${target}
          AND a."performedById" = i."assigneeId"
          AND a."clientCreatedAt" >= ${createdAt}
        WHERE i."lotId" = ${id} AND i."assigneeId" IS NOT NULL
        GROUP BY i."assigneeId"
      ),
      hors_attribution AS (
        SELECT
          a."performedById" AS id,
          COUNT(*)::int AS "outsideAssignmentCalls"
        FROM "lot_export_items" i
        INNER JOIN tentatives a
          ON a."targetId" = ${target}
          AND a."performedById" <> i."assigneeId"
          AND a."clientCreatedAt" >= ${createdAt}
        WHERE i."lotId" = ${id}
          AND a."performedById" IN (
            SELECT own."assigneeId"
            FROM "lot_export_items" own
            WHERE own."lotId" = ${id} AND own."assigneeId" IS NOT NULL
          )
        GROUP BY a."performedById"
      )
      SELECT
        m.id,
        m.name,
        m.assigned,
        COALESCE(c.treated, 0)::int AS treated,
        COALESCE(c."assignedCalls", 0)::int AS "assignedCalls",
        COALESCE(h."outsideAssignmentCalls", 0)::int AS "outsideAssignmentCalls"
      FROM membres m
      LEFT JOIN conformes c ON c.id = m.id
      LEFT JOIN hors_attribution h ON h.id = m.id
      ORDER BY m.name ASC
    `;

    return rows.map((row) => ({
      teleconseillerId: row.id,
      teleconseillerName: row.name,
      objectif: distribution?.objectifs[row.id] ?? distribution?.fichesParJour ?? 0,
      assigned: row.assigned,
      treated: row.treated,
      completionRate:
        row.assigned === 0 ? 0 : Math.round((row.treated / row.assigned) * 1_000) / 10,
      assignedCalls: row.assignedCalls,
      outsideAssignmentCalls: row.outsideAssignmentCalls,
    }));
  }

  private async lot(id: string): Promise<{
    id: string;
    cible: LotExportCible;
    filters: Prisma.JsonValue;
    createdAt: Date;
  }> {
    const row = await this.prisma.lotExport.findUnique({
      where: { id },
      select: { id: true, cible: true, filters: true, createdAt: true },
    });
    if (!row)
      throw new NotFoundException({
        code: 'LOT_EXPORT_NOT_FOUND',
        message: 'Campagne introuvable.',
      });
    return row;
  }

  /**
   * Les positions déjà appelées depuis la création de la campagne.
   *
   * Sur la POSITION et non sur la fiche : la même personne peut figurer dans
   * deux campagnes, et c'est cette ligne-ci qui est traitée ou non.
   */
  private async positionsTraitees(lot: {
    id: string;
    cible: LotExportCible;
    createdAt: Date;
  }): Promise<Set<number>> {
    const rows = surRepresentants(lot.cible)
      ? await this.prisma.$queryRaw<{ position: number }[]>`
          SELECT DISTINCT i.position FROM "lot_export_items" i
          INNER JOIN "rep_call_attempts" a ON a."representantId" = i."representantId"
          WHERE i."lotId" = ${lot.id} AND a."clientCreatedAt" >= ${lot.createdAt}`
      : await this.prisma.$queryRaw<{ position: number }[]>`
          SELECT DISTINCT i.position FROM "lot_export_items" i
          INNER JOIN "call_attempts" a ON a."prospectId" = i."prospectId"
          WHERE i."lotId" = ${lot.id} AND a."clientCreatedAt" >= ${lot.createdAt}`;
    return new Set(rows.map((row) => row.position));
  }

  /**
   * EB-18 : les fiches d'une campagne, avec leur état et le statut posé.
   *
   * Le superviseur voit toute la campagne ; le filtre par téléconseiller sert à
   * la lire personne par personne.
   */
  async fiches(id: string, query: LotExportFichesQueryDto): Promise<LotExportFichesDto> {
    const lot = await this.lot(id);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.LotExportItemWhereInput = {
      lotId: id,
      ...(query.teleconseillerId ? { assigneeId: query.teleconseillerId } : {}),
    };

    const traitees = await this.positionsTraitees(lot);
    const rows = await this.prisma.lotExportItem.findMany({
      where,
      orderBy: { position: 'asc' },
      select: {
        position: true,
        day: true,
        assigneeId: true,
        assignee: { select: { fullName: true } },
        representant: {
          select: {
            id: true,
            fullName: true,
            phoneE164: true,
            nextCallbackAt: true,
            statutQualification: { select: { label: true } },
          },
        },
        prospect: {
          select: { id: true, nom: true, prenom: true, phoneE164: true, lastCallOutcome: true },
        },
      },
    });

    const items = rows.map((row) => ficheDe(row, traitees.has(row.position)));
    const retenues =
      query.etat === undefined ? items : items.filter((item) => item.etat === query.etat);
    return {
      items: retenues.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        total: retenues.length,
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(retenues.length / pageSize)),
      },
    };
  }

  /** Le nombre de fiches que la cible offre, avant que la répartition ne la borne. */
  private async compter(body: CreateLotExportDto): Promise<number> {
    if (body.cible === LotExportCible.CONTACTS_RECOMMANDES) {
      const groupes = await this.prisma.representantSuggestion.groupBy({
        by: ['suggestedPhoneE164'],
        where: this.suggestionWhere(body.representants),
      });
      return groupes.length;
    }
    if (surRepresentants(body.cible))
      return this.prisma.representant.count({ where: this.cibleWhere(body) });
    return this.prisma.prospect.count({ where: buildProspectWhere(ADMIN, body.prospects ?? {}) });
  }

  /** Les fiches retenues, dans l'ordre où la répartition les distribuera. */
  private async tirer(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    body: CreateLotExportDto,
    places: number,
  ): Promise<{ id: string }[]> {
    if (body.cible === LotExportCible.CONTACTS_RECOMMANDES)
      return this.ouvrirLesContactsRecommandes(tx, user, body, places);
    if (surRepresentants(body.cible))
      return tx.representant.findMany({
        where: this.cibleWhere(body),
        orderBy: { id: 'asc' },
        take: places,
        select: { id: true },
      });
    return tx.prospect.findMany({
      where: buildProspectWhere(user, body.prospects ?? {}),
      orderBy: { id: 'asc' },
      take: places,
      select: { id: true },
    });
  }

  /**
   * EB-19 : un contact recommandé devient une fiche au LANCEMENT de la campagne.
   *
   * `RepresentantSuggestion` n'est pas appelable : elle n'a ni département ni
   * qualification, et son numéro ne réserve rien. La fiche naît ici, rattachée
   * au département de celui qui l'a nommée, et la suggestion pointe dessus.
   *
   * Le numéro porte un index unique partiel sur `Representant` : deux
   * suggestions du même numéro, ou un numéro déjà connu, ne donnent qu'une
   * fiche. Sans ce dédoublonnage la transaction entière échouerait.
   */
  private async ouvrirLesContactsRecommandes(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    body: CreateLotExportDto,
    places: number,
  ): Promise<{ id: string }[]> {
    const suggestions = await tx.representantSuggestion.findMany({
      where: this.suggestionWhere(body.representants),
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        suggestedName: true,
        suggestedPhoneE164: true,
        sourceRepresentant: { select: { departementId: true, iefId: true } },
      },
    });

    const numeros = [...new Set(suggestions.map((piste) => piste.suggestedPhoneE164))];
    const connus = new Set(
      (
        await tx.representant.findMany({
          where: { phoneE164: { in: numeros }, deletedAt: null },
          select: { phoneE164: true },
        })
      ).map((fiche) => fiche.phoneE164),
    );

    const maintenant = new Date();
    const fiches: { id: string }[] = [];
    for (const piste of suggestions) {
      if (fiches.length >= places) break;
      if (connus.has(piste.suggestedPhoneE164)) continue;
      connus.add(piste.suggestedPhoneE164);
      const id = uuidv7();
      await tx.representant.create({
        data: {
          id,
          fullName: piste.suggestedName?.trim() || 'Contact recommandé',
          phoneE164: piste.suggestedPhoneE164,
          departementId: piste.sourceRepresentant.departementId,
          iefId: piste.sourceRepresentant.iefId,
          createdById: user.id,
          clientCreatedAt: maintenant,
        },
      });
      await tx.representantSuggestion.update({
        where: { id: piste.id },
        data: { resolvedRepresentantId: id },
      });
      fiches.push({ id });
    }
    return fiches;
  }

  private suggestionWhere(
    query?: RepresentantExportQueryDto,
  ): Prisma.RepresentantSuggestionWhereInput {
    const value = query ?? {};
    return {
      deletedAt: null,
      status: SuggestionStatus.A_APPELER,
      resolvedRepresentantId: null,
      sourceRepresentant: {
        deletedAt: null,
        ...(value.departementId ? { departementId: value.departementId } : {}),
        ...(value.iefId ? { iefId: value.iefId } : {}),
      },
    };
  }

  private cibleWhere(body: CreateLotExportDto): Prisma.RepresentantWhereInput {
    const where = this.representantWhere(body.representants);
    if (body.cible !== LotExportCible.REPRESENTANTS_INJOIGNABLES) return where;
    // EB-19 : « hors Injoignable définitif » se lit sur le délai de reprise, et
    // non sur un code écrit ici : l'administrateur peut créer d'autres statuts
    // qui ne repassent jamais, et ils doivent sortir de la cible eux aussi.
    return {
      ...where,
      lastCallOutcome: RepCallOutcome.UNREACHABLE,
      statutQualification: {
        effect: StatutQualificationEffect.UNREACHABLE,
        retryAfterMinutes: { not: null },
      },
    };
  }

  private representantWhere(query?: RepresentantExportQueryDto): Prisma.RepresentantWhereInput {
    const value = query ?? {};
    const where: Prisma.RepresentantWhereInput = { deletedAt: null, ...suiviWhere(value) };
    if (value.search?.trim())
      where.OR = [
        { fullName: { contains: value.search.trim(), mode: 'insensitive' } },
        { phoneE164: { contains: value.search.replace(/[^\d+]/g, '') } },
      ];
    if (value.departementId) where.departementId = value.departementId;
    if (value.iefId) where.iefId = value.iefId;
    if (value.relationStatus) where.relationStatus = value.relationStatus;
    if (value.hasProspects === true) where.prospects = { some: { deletedAt: null } };
    if (value.hasProspects === false) where.prospects = { none: { deletedAt: null } };
    if (value.whatsappStatus) where.whatsappStatus = value.whatsappStatus;
    return where;
  }
}

function placesDe(membres: readonly MembreRepartition[], jours: number): number {
  return membres.reduce((total, membre) => total + membre.fichesParJour, 0) * jours;
}

function capacites(
  equipe: readonly Teleconseiller[],
  fichesParJour: number,
  objectifs: Readonly<Record<string, number>> = {},
): MembreRepartition[] {
  return equipe.map((membre) => ({
    assigneeId: membre.id,
    fichesParJour: objectifs[membre.id] ?? capaciteParJour(membre.role, fichesParJour),
  }));
}

/** Le tableau reçu du client, réduit à ce que la distribution stockée porte. */
function objectifsDe(saisis: readonly LotExportObjectifDto[] | undefined): Record<string, number> {
  return Object.fromEntries(
    (saisis ?? []).map((objectif) => [objectif.teleconseillerId, objectif.fichesParJour]),
  );
}

const REPARTITION_COLUMNS = [
  { header: 'Téléconseiller', key: 'teleconseiller', width: 26 },
  { header: 'Jour', key: 'jour', width: 8 },
];

function trierParTeleconseiller(
  items: readonly ItemRow[],
  distribution: Distribution | null,
): ItemRow[] {
  const rangs = new Map<string, number>();
  for (const id of distribution?.teleconseillerIds ?? []) rangs.set(id, rangs.size);
  for (const item of items)
    if (item.assigneeId !== null && !rangs.has(item.assigneeId))
      rangs.set(item.assigneeId, rangs.size);

  const rangDe = (assigneeId: string | null): number =>
    assigneeId === null
      ? Number.MAX_SAFE_INTEGER
      : (rangs.get(assigneeId) ?? Number.MAX_SAFE_INTEGER);

  return [...items].sort(
    (left, right) =>
      rangDe(left.assigneeId) - rangDe(right.assigneeId) ||
      left.day - right.day ||
      left.position - right.position,
  );
}

function readDistribution(filters: Prisma.JsonValue): Distribution | null {
  if (typeof filters !== 'object' || filters === null || Array.isArray(filters)) return null;
  const raw = (filters as Record<string, unknown>).distribution;
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const teleconseillerIds = Array.isArray(value.teleconseillerIds)
    ? value.teleconseillerIds.filter((id): id is string => typeof id === 'string')
    : [];
  const fichesParJour = typeof value.fichesParJour === 'number' ? value.fichesParJour : 0;
  const jours = typeof value.jours === 'number' ? value.jours : 0;
  if (!teleconseillerIds.length || fichesParJour < 1 || jours < 1) return null;
  return { teleconseillerIds, fichesParJour, jours, objectifs: readObjectifs(value.objectifs) };
}

/**
 * Réécrit la distribution SANS toucher aux critères qui l'entourent : ceux-ci
 * disent quelles fiches ont été tirées, et les perdre effacerait l'étiquette de
 * la campagne.
 */
function ecrireLaDistribution(
  filters: Prisma.JsonValue,
  changer: (distribution: Distribution) => Distribution,
): Prisma.InputJsonValue {
  const base =
    typeof filters === 'object' && filters !== null && !Array.isArray(filters)
      ? (filters as Record<string, unknown>)
      : {};
  const courante = readDistribution(filters) ?? {
    teleconseillerIds: [],
    fichesParJour: 1,
    jours: 1,
    objectifs: {},
  };
  return { ...base, distribution: { ...changer(courante) } } as Prisma.InputJsonValue;
}

interface FicheRow {
  position: number;
  day: number;
  assigneeId: string | null;
  assignee: { fullName: string } | null;
  representant: {
    id: string;
    fullName: string;
    phoneE164: string;
    nextCallbackAt: Date | null;
    statutQualification: { label: string } | null;
  } | null;
  prospect: {
    id: string;
    nom: string;
    prenom: string | null;
    phoneE164: string;
    lastCallOutcome: CallOutcome | null;
  } | null;
}

function ficheDe(row: FicheRow, traitee: boolean): LotExportFicheDto {
  const fiche = row.representant;
  const prospect = row.prospect;
  return {
    position: row.position,
    jour: row.day,
    ficheId: fiche?.id ?? prospect?.id ?? null,
    fullName: fiche?.fullName ?? [prospect?.nom, prospect?.prenom].filter(Boolean).join(' '),
    phoneE164: fiche?.phoneE164 ?? prospect?.phoneE164 ?? '',
    teleconseillerId: row.assigneeId,
    teleconseillerName: row.assignee?.fullName ?? 'Non attribuée',
    etat: etatDe(traitee, fiche?.nextCallbackAt != null),
    statutLabel: statutDe(row),
  };
}

function etatDe(traitee: boolean, attendUnRappel: boolean): LotExportFicheEtat {
  if (attendUnRappel) return LotExportFicheEtat.A_RAPPELER;
  return traitee ? LotExportFicheEtat.TRAITEE : LotExportFicheEtat.NON_TRAITEE;
}

/** Un prospect ne porte pas de statut de qualification : son dernier appel en tient lieu. */
function statutDe(row: FicheRow): string | null {
  const label = row.representant?.statutQualification?.label;
  if (label !== undefined) return label;
  const outcome = row.prospect?.lastCallOutcome;
  return outcome == null ? null : CALL_OUTCOME_LABELS[outcome];
}

function readObjectifs(raw: unknown): Record<string, number> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).flatMap(([id, valeur]) =>
      typeof valeur === 'number' && valeur >= 1 ? [[id, valeur] as [string, number]] : [],
    ),
  );
}

interface ScopeFilters {
  relationStatus?: string;
  segment?: string;
  type?: string;
  projet?: string;
}

function scopeLabel(cible: LotExportCible, filters: unknown): string {
  const f = (filters ?? {}) as ScopeFilters;
  if (cible === LotExportCible.REPRESENTANTS_INJOIGNABLES) return 'Représentants injoignables';
  if (cible === LotExportCible.CONTACTS_RECOMMANDES) return 'Contacts recommandés';
  if (cible === LotExportCible.REPRESENTANTS) {
    if (!f.relationStatus) return 'Tous les représentants';
    return f.relationStatus === 'INCONNU'
      ? 'Représentants non qualifiés'
      : `Représentants ${f.relationStatus.toLowerCase()}`;
  }
  if (f.segment) return `${f.projet ?? 'Tous projets'}, segment ${f.segment}`;
  if (f.type) return `${f.projet ?? 'Grand Public'}, ${f.type.toLowerCase().replace('_', ' ')}`;
  return f.projet ?? 'Tous projets';
}
