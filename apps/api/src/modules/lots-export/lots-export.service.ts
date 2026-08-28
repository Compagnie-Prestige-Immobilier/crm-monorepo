import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { LotExportCible, Prisma, Projet, Role, WhatsappStatus } from '@crm/database';
import type { Writable } from 'node:stream';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildProspectWhere } from '../../common/prospect-where.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import type { RepresentantExportQueryDto } from '../representants/dto.js';
import { ExportService } from '../export/export.service.js';
import { RepresentantsExportService } from '../export/representants-export.service.js';
import { CreateLotExportDto, LotExportAttemptDto, LotExportDetailDto, LotExportListDto, LotExportPreviewDto, LotExportQueryDto, LotExportSummaryDto } from './dto.js';

const ADMIN = { id: 'admin', role: Role.ADMIN } as const;
const CHUNK = 5_000;

@Injectable()
export class LotsExportService {
  constructor(private readonly prisma: PrismaService, private readonly exports: ExportService, private readonly repsExport: RepresentantsExportService) {}

  async preview(body: CreateLotExportDto): Promise<LotExportPreviewDto> {
    const eligible = body.cible === LotExportCible.REPRESENTANTS
      ? await this.prisma.representant.count({ where: this.representantWhere(body.representants) })
      : await this.prisma.prospect.count({ where: buildProspectWhere(ADMIN, body.prospects ?? {}) });
    return { eligible, scopeLabel: scopeLabel(body.cible, body.representants ?? body.prospects ?? {}) };
  }

  async create(user: AuthenticatedUser, body: CreateLotExportDto): Promise<LotExportSummaryDto> {
    const filters = body.cible === LotExportCible.REPRESENTANTS ? body.representants : body.prospects;
    if (!filters) throw new UnprocessableEntityException({ code: 'LOT_EXPORT_FILTRES_REQUIS', message: 'Les critères de la cible sont requis.' });
    const id = await this.prisma.$transaction(async (tx) => {
      const items = body.cible === LotExportCible.REPRESENTANTS
        ? (await tx.representant.findMany({ where: this.representantWhere(body.representants), orderBy: { id: 'asc' }, select: { id: true } })).map((row) => ({ representantId: row.id }))
        : (await tx.prospect.findMany({ where: buildProspectWhere(user, body.prospects ?? {}), orderBy: { id: 'asc' }, select: { id: true } })).map((row) => ({ prospectId: row.id }));
      if (!items.length) throw new UnprocessableEntityException({ code: 'LOT_EXPORT_CIBLE_VIDE', message: 'Aucune fiche ne correspond à cette cible.' });
      const lot = await tx.lotExport.create({ data: { name: body.name.trim(), cible: body.cible, projet: body.cible === LotExportCible.REPRESENTANTS ? Projet.CHUES : body.prospects?.projet ?? null, filters: filters as Prisma.InputJsonValue, itemCount: items.length, createdById: user.id } });
      for (let start = 0; start < items.length; start += CHUNK) await tx.lotExportItem.createMany({ data: items.slice(start, start + CHUNK).map((item, index) => ({ lotId: lot.id, position: start + index, ...item })) });
      return lot.id;
    }, { timeout: 120_000, maxWait: 15_000 });
    return this.summary(id);
  }

  async list(query: LotExportQueryDto): Promise<LotExportListDto> {
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 25;
    const where: Prisma.LotExportWhereInput = { ...(query.search ? { name: { contains: query.search.trim(), mode: 'insensitive' } } : {}), ...(query.cible ? { cible: query.cible } : {}), ...(query.createdById ? { createdById: query.createdById } : {}), ...(query.dateFrom || query.dateTo ? { createdAt: { ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}) } } : {}) };
    const [total, rows] = await Promise.all([this.prisma.lotExport.count({ where }), this.prisma.lotExport.findMany({ where, include: { createdBy: { select: { fullName: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize })]);
    return { items: await Promise.all(rows.map((row) => this.summary(row.id, row))), meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) } };
  }

  async get(id: string): Promise<LotExportDetailDto> {
    const row = await this.prisma.lotExport.findUnique({ where: { id }, include: { createdBy: { select: { fullName: true } } } });
    if (!row) throw new NotFoundException({ code: 'LOT_EXPORT_NOT_FOUND', message: 'Lot introuvable.' });
    return { ...(await this.summary(id, row)), callsByTeleconseiller: await this.callsByUser(row.id, row.cible, row.createdAt), recentAttempts: await this.recentAttempts(row.id, row.cible, row.createdAt) };
  }

  async writeXlsx(id: string, user: AuthenticatedUser, stream: Writable): Promise<void> {
    const row = await this.prisma.lotExport.findUnique({ where: { id }, select: { cible: true, items: { orderBy: { position: 'asc' }, select: { representantId: true, prospectId: true } } } });
    if (!row) throw new NotFoundException({ code: 'LOT_EXPORT_NOT_FOUND', message: 'Lot introuvable.' });
    if (row.cible === LotExportCible.REPRESENTANTS) return this.repsExport.writeRepresentants(user, {}, stream, row.items.flatMap((item) => item.representantId ? [item.representantId] : []));
    return this.exports.writeProspectsForIds(user, row.items.flatMap((item) => item.prospectId ? [item.prospectId] : []), stream);
  }

  private async summary(id: string, row?: any): Promise<LotExportSummaryDto> {
    const lot = row ?? await this.prisma.lotExport.findUnique({ where: { id }, include: { createdBy: { select: { fullName: true } } } });
    if (!lot) throw new NotFoundException({ code: 'LOT_EXPORT_NOT_FOUND', message: 'Lot introuvable.' });
    const stats = await this.stats(lot.id, lot.cible, lot.createdAt);
    return { id: lot.id, name: lot.name, cible: lot.cible, projet: lot.projet, scopeLabel: scopeLabel(lot.cible, lot.filters), itemCount: lot.itemCount, createdById: lot.createdById, createdByName: lot.createdBy.fullName, createdAt: lot.createdAt.toISOString(), callsSince: stats.calls, fichesAppelees: stats.fiches };
  }

  private async stats(id: string, cible: LotExportCible, createdAt: Date): Promise<{ calls: number; fiches: number }> {
    const [row] = cible === LotExportCible.REPRESENTANTS
      ? await this.prisma.$queryRaw<{ calls: number; fiches: number }[]>`SELECT COUNT(*)::int AS calls, COUNT(DISTINCT a."representantId")::int AS fiches FROM "lot_export_items" i INNER JOIN "rep_call_attempts" a ON a."representantId" = i."representantId" WHERE i."lotId" = ${id} AND a."clientCreatedAt" >= ${createdAt}`
      : await this.prisma.$queryRaw<{ calls: number; fiches: number }[]>`SELECT COUNT(*)::int AS calls, COUNT(DISTINCT a."prospectId")::int AS fiches FROM "lot_export_items" i INNER JOIN "call_attempts" a ON a."prospectId" = i."prospectId" WHERE i."lotId" = ${id} AND a."clientCreatedAt" >= ${createdAt}`;
    return row ?? { calls: 0, fiches: 0 };
  }

  private async recentAttempts(id: string, cible: LotExportCible, createdAt: Date): Promise<LotExportAttemptDto[]> {
    if (cible === LotExportCible.REPRESENTANTS) {
      const rows = await this.prisma.repCallAttempt.findMany({ where: { representant: { lotItems: { some: { lotId: id } } }, clientCreatedAt: { gte: createdAt } }, include: { representant: { select: { phoneE164: true } }, performedBy: { select: { fullName: true } } }, orderBy: [{ clientCreatedAt: 'desc' }, { id: 'desc' }], take: 50 });
      return rows.map((row) => ({ id: row.id, phoneE164: row.representant.phoneE164, shortCode: '', outcome: row.outcome, method: null, comment: row.comment, performedByName: row.performedBy.fullName, createdAt: row.createdAt.toISOString(), email: null, fonctionnaire: null, engagementEnCours: null, dureeEtablissementMois: null, rendezVousAt: null }));
    }
    const rows = await this.prisma.callAttempt.findMany({ where: { prospect: { lotItems: { some: { lotId: id } } }, clientCreatedAt: { gte: createdAt } }, include: { prospect: { select: { phoneE164: true } }, performedBy: { select: { fullName: true } } }, orderBy: [{ clientCreatedAt: 'desc' }, { id: 'desc' }], take: 50 });
    return rows.map((row) => ({ id: row.id, phoneE164: row.prospect.phoneE164, shortCode: '', outcome: row.outcome, method: row.method, comment: row.comment, performedByName: row.performedBy.fullName, createdAt: row.createdAt.toISOString(), email: row.email, fonctionnaire: row.fonctionnaire, engagementEnCours: row.engagementEnCours, dureeEtablissementMois: row.dureeEtablissementMois, rendezVousAt: row.rendezVousAt?.toISOString() ?? null }));
  }

  private async callsByUser(id: string, cible: LotExportCible, createdAt: Date): Promise<Record<string, number>> {
    const rows = cible === LotExportCible.REPRESENTANTS
      ? await this.prisma.$queryRaw<{ name: string; calls: number }[]>`SELECT u."fullName" AS name, COUNT(*)::int AS calls FROM "rep_call_attempts" a INNER JOIN "lot_export_items" i ON i."representantId" = a."representantId" INNER JOIN "users" u ON u."id" = a."performedById" WHERE i."lotId" = ${id} AND a."clientCreatedAt" >= ${createdAt} GROUP BY u."id", u."fullName"`
      : await this.prisma.$queryRaw<{ name: string; calls: number }[]>`SELECT u."fullName" AS name, COUNT(*)::int AS calls FROM "call_attempts" a INNER JOIN "lot_export_items" i ON i."prospectId" = a."prospectId" INNER JOIN "users" u ON u."id" = a."performedById" WHERE i."lotId" = ${id} AND a."clientCreatedAt" >= ${createdAt} GROUP BY u."id", u."fullName"`;
    return Object.fromEntries(rows.map((row) => [row.name, row.calls]));
  }

  private representantWhere(query?: RepresentantExportQueryDto): Prisma.RepresentantWhereInput {
    const value = query ?? {}; const where: Prisma.RepresentantWhereInput = { deletedAt: null };
    if (value.search?.trim()) where.OR = [{ fullName: { contains: value.search.trim(), mode: 'insensitive' } }, { phoneE164: { contains: value.search.replace(/[^\d+]/g, '') } }];
    if (value.departementId) where.departementId = value.departementId; if (value.iefId) where.iefId = value.iefId; if (value.relationStatus) where.relationStatus = value.relationStatus;
    if (value.hasProspects === true) where.prospects = { some: { deletedAt: null } }; if (value.hasProspects === false) where.prospects = { none: { deletedAt: null } };
    if (value.whatsappStatus) where.whatsappStatus = value.whatsappStatus; return where;
  }
}

function scopeLabel(cible: LotExportCible, filters: any): string {
  if (cible === LotExportCible.REPRESENTANTS) return filters.relationStatus ? `Représentants ${filters.relationStatus.toLowerCase()}` : 'Tous les représentants';
  if (filters.segment) return `${filters.projet ?? 'Tous projets'}, segment ${filters.segment}`;
  if (filters.type) return `${filters.projet ?? 'Grand Public'}, ${filters.type.toLowerCase().replace('_', ' ')}`;
  return filters.projet ?? 'Tous projets';
}
