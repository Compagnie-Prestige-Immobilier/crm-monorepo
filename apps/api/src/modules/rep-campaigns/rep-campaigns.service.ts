import { Injectable, Logger } from '@nestjs/common';
import {
  CallTaskStatus,
  CampaignStatus,
  ChangeSource,
  Prisma,
  RepCallOutcome,
  Role,
} from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { shortCode } from '../../common/short-code.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import {
  MIN_SPREAD_DAYS,
  dayHistogram,
  dayIndexFor,
  distributeRoundRobin,
  newCampaignSeed,
  shuffleInPostgres,
} from '../phase2/distribution.js';
import { COMMENT_MAX_LENGTH } from '../phase2/attempt-rules.js';
import type { CheckboxGroup, ProgrammeRow } from '../phase2/programme-pdf.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';
import {
  commentRequired,
  commercialInactive,
  commercialNotFound,
  dayNotFound,
  noEligibleRepresentant,
  notACommercial,
  programmeNotFound,
  promisedNotAllowed,
  repCampaignNotFound,
  representantAlreadyAssigned,
  representantNotFound,
} from './errors.js';
import { applyRelationChange } from '../representants/relation-change.js';
import { resolveWhatsappPatch } from '../representants/whatsapp.js';
import { RepresentantsService } from '../representants/representants.service.js';
import type { RepresentantLookupDto } from '../representants/dto.js';
import { RepCallAttemptApplyStatus } from './dto.js';
import type {
  CreateRepCallAttemptDto,
  CreateRepCampaignDto,
  RepCallAttemptResultDto,
  RepCampaignCommercialDto,
  RepCampaignDetailDto,
  RepCampaignListDto,
  RepCampaignPreviewDto,
  RepCampaignPreviewQueryDto,
  RepCampaignProgressDto,
  RepCampaignQueryDto,
  RepCampaignSummaryDto,
} from './dto.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';

const CAMPAIGN_TRANSACTION_TIMEOUT_MS = 120_000;
const CAMPAIGN_TRANSACTION_MAX_WAIT_MS = 15_000;

const TASK_INSERT_CHUNK = 5_000;

const RECENT_ATTEMPTS = 20;

const TERMINAL_OUTCOMES: readonly RepCallOutcome[] = [
  RepCallOutcome.REACHED,
  RepCallOutcome.PROSPECTS_PROMISED,
  RepCallOutcome.REFUSED,
  RepCallOutcome.WRONG_NUMBER,
];

export const REP_CHECKBOX_GROUPS: readonly CheckboxGroup[] = [
  { caption: 'Résultat', options: ['Échange fait', 'Fiches promises'] },
  { caption: 'Autre', options: ['Injoignable', 'Rappeler', 'Refus', 'Faux numéro', 'Autre'] },
];

const emptyProgress = (): RepCampaignProgressDto => ({ total: 0, open: 0, done: 0, cancelled: 0 });

const zeroes = (length: number): number[] => Array.from({ length: Math.max(1, length) }, () => 0);

type ProgressIndex = Map<string, RepCampaignProgressDto>;

function tally(progress: RepCampaignProgressDto, status: CallTaskStatus, count: number): void {
  progress.total += count;
  if (status === CallTaskStatus.OPEN) progress.open += count;
  else if (status === CallTaskStatus.DONE) progress.done += count;
  else progress.cancelled += count;
}

function tallyInto(index: ProgressIndex, key: string, status: CallTaskStatus, count: number): void {
  const progress = index.get(key) ?? emptyProgress();
  tally(progress, status, count);
  index.set(key, progress);
}

interface ScopeInput {
  readonly departementId?: string | null;
  readonly iefId?: string | null;
  readonly onlyWithoutProspects?: boolean | null;
}

@Injectable()
export class RepCampaignsService {
  private readonly logger = new Logger(RepCampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
    private readonly representants: RepresentantsService,
  ) {}

  async create(user: AuthenticatedUser, body: CreateRepCampaignDto): Promise<RepCampaignDetailDto> {
    const commerciaux = await this.resolveCommerciaux(body.commercialIds);
    const seed = newCampaignSeed();
    const spreadDays = body.spreadDays ?? MIN_SPREAD_DAYS;
    const demoEnabled = await this.demo.enabledForWrite();

    const campaignId = await this.prisma
      .$transaction(
        async (tx) => {
          const campaign = await tx.repCallCampaign.create({
            data: {
              name: body.name.trim(),
              seed,
              spreadDays,
              departementId: body.departementId ?? null,
              iefId: body.iefId ?? null,
              onlyWithoutProspects: body.onlyWithoutProspects ?? false,
              createdById: user.id,
              isDemo: demoEnabled,
            },
          });

          await tx.repCallCampaignCommercial.createMany({
            data: commerciaux.map((commercial, index) => ({
              campaignId: campaign.id,
              userId: commercial.id,
              position: index + 1,
            })),
          });

          const eligible = await tx.representant.findMany({
            where: eligibleWhere(body, demoEnabled),
            select: { id: true },
            orderBy: { id: 'asc' },
          });

          if (eligible.length === 0) throw noEligibleRepresentant();

          const ordered = await shuffleInPostgres(
            tx,
            seed,
            eligible.map((row) => row.id),
          );

          const assignments = distributeRoundRobin(ordered, commerciaux.length);
          const queueSize = assignments.reduce<number[]>((sizes, assignment) => {
            sizes[assignment.bucket] = (sizes[assignment.bucket] ?? 0) + 1;
            return sizes;
          }, []);

          const rows = assignments.flatMap((assignment) => {
            const commercial = commerciaux[assignment.bucket];
            if (!commercial) return [];
            return [
              {
                campaignId: campaign.id,
                representantId: assignment.item,
                assignedToId: commercial.id,
                position: assignment.position,
                dayIndex: dayIndexFor(
                  assignment.position,
                  queueSize[assignment.bucket] ?? 0,
                  spreadDays,
                ),
                isDemo: demoEnabled,
              },
            ];
          });

          for (let start = 0; start < rows.length; start += TASK_INSERT_CHUNK) {
            await tx.repCallTask.createMany({ data: rows.slice(start, start + TASK_INSERT_CHUNK) });
          }

          this.logger.log(
            `Campagne représentants ${campaign.id} : ${String(rows.length)} tâches réparties entre ${String(commerciaux.length)} commerciaux sur ${String(spreadDays)} jour(s)`,
          );
          return campaign.id;
        },
        { timeout: CAMPAIGN_TRANSACTION_TIMEOUT_MS, maxWait: CAMPAIGN_TRANSACTION_MAX_WAIT_MS },
      )
      .catch((error: unknown) => {
        throw translateWriteError(error);
      });

    return this.get(campaignId);
  }

  private async resolveCommerciaux(
    ids: readonly string[],
  ): Promise<{ id: string; fullName: string; username: string }[]> {
    const found = await this.prisma.user.findMany({
      where: { id: { in: [...ids] }, deletedAt: null, ...demoScope(await this.demo.enabled()) },
      select: { id: true, fullName: true, username: true, role: true, isActive: true },
    });

    const byId = new Map(found.map((row) => [row.id, row]));

    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) throw commercialNotFound(missing);

    const wrongRole = ids.filter((id) => byId.get(id)?.role !== Role.COMMERCIAL);
    if (wrongRole.length > 0) throw notACommercial(wrongRole);

    const inactive = ids.filter((id) => byId.get(id)?.isActive !== true);
    if (inactive.length > 0) throw commercialInactive(inactive);

    return ids.flatMap((id) => {
      const row = byId.get(id);
      if (!row) return [];
      return { id: row.id, fullName: row.fullName, username: row.username };
    });
  }

  async preview(query: RepCampaignPreviewQueryDto): Promise<RepCampaignPreviewDto> {
    const eligible = await this.prisma.representant.count({
      where: eligibleWhere(query, await this.demo.enabled()),
    });

    const commercialCount = Math.max(1, query.commercialCount ?? 1);
    const perCommercial = Math.ceil(eligible / commercialCount);

    return {
      eligible,
      perCommercial,
      perDay: dayHistogram(perCommercial, query.spreadDays ?? MIN_SPREAD_DAYS),
      scopeLabel: await this.scopeLabel(query),
    };
  }

  async list(query: RepCampaignQueryDto): Promise<RepCampaignListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const search = query.search?.trim();

    const where: Prisma.RepCallCampaignWhereInput = {
      ...demoScope(await this.demo.enabled()),
      ...(query.status ? { status: query.status } : {}),
      ...(query.createdById ? { createdById: query.createdById } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: inclusiveDateFrom(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: inclusiveDateTo(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [total, campaigns] = await Promise.all([
      this.prisma.repCallCampaign.count({ where }),
      this.prisma.repCallCampaign.findMany({
        where,
        include: {
          createdBy: { select: { fullName: true } },
          departement: { select: { name: true } },
          ief: { select: { name: true } },
          _count: { select: { commerciaux: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const progress = await this.progressByCampaign(campaigns.map((row) => row.id));

    return {
      items: campaigns.map((row): RepCampaignSummaryDto => ({
        id: row.id,
        name: row.name,
        status: row.status,
        seed: row.seed,
        scopeLabel: composeScopeLabel(
          row.departement?.name ?? null,
          row.ief?.name ?? null,
          row.onlyWithoutProspects,
        ),
        departementId: row.departementId,
        iefId: row.iefId,
        onlyWithoutProspects: row.onlyWithoutProspects,
        createdById: row.createdById,
        createdByName: row.createdBy.fullName,
        commercialCount: row._count.commerciaux,
        spreadDays: row.spreadDays,
        progress: progress.get(row.id) ?? emptyProgress(),
        createdAt: row.createdAt.toISOString(),
        closedAt: row.closedAt?.toISOString() ?? null,
      })),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async get(id: string): Promise<RepCampaignDetailDto> {
    const campaign = await this.prisma.repCallCampaign.findFirst({
      where: { id, ...demoScope(await this.demo.enabled()) },
      include: {
        createdBy: { select: { fullName: true } },
        departement: { select: { name: true } },
        ief: { select: { name: true } },
        commerciaux: {
          orderBy: { position: 'asc' },
          include: { user: { select: { id: true, fullName: true, username: true } } },
        },
      },
    });

    if (!campaign) throw repCampaignNotFound();

    const demoWhere = demoScope(await this.demo.enabled());

    const grouped = await this.prisma.repCallTask.groupBy({
      by: ['assignedToId', 'status'],
      where: { campaignId: id, ...demoWhere },
      _count: { _all: true },
    });

    const perCommercial: ProgressIndex = new Map();
    const overall = emptyProgress();
    for (const row of grouped) {
      tallyInto(perCommercial, row.assignedToId, row.status, row._count._all);
      tally(overall, row.status, row._count._all);
    }

    const perDay = await this.dayCounts(id, campaign.spreadDays);

    const attempts = await this.prisma.repCallAttempt.findMany({
      where: { campaignId: id, ...demoWhere },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: RECENT_ATTEMPTS,
      include: {
        representant: { select: { id: true, phoneE164: true } },
        performedBy: { select: { fullName: true } },
        task: { select: { assignedToId: true } },
      },
    });

    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      seed: campaign.seed,
      scopeLabel: composeScopeLabel(
        campaign.departement?.name ?? null,
        campaign.ief?.name ?? null,
        campaign.onlyWithoutProspects,
      ),
      departementId: campaign.departementId,
      iefId: campaign.iefId,
      onlyWithoutProspects: campaign.onlyWithoutProspects,
      createdById: campaign.createdById,
      createdByName: campaign.createdBy.fullName,
      commercialCount: campaign.commerciaux.length,
      spreadDays: campaign.spreadDays,
      progress: overall,
      createdAt: campaign.createdAt.toISOString(),
      closedAt: campaign.closedAt?.toISOString() ?? null,
      perDay: perDay.overall,
      commerciaux: campaign.commerciaux.map((row): RepCampaignCommercialDto => ({
        userId: row.user.id,
        fullName: row.user.fullName,
        username: row.user.username,
        position: row.position,
        progress: perCommercial.get(row.user.id) ?? emptyProgress(),
        perDay: perDay.byUser.get(row.user.id) ?? zeroes(campaign.spreadDays),
      })),
      recentAttempts: attempts.map((row) => ({
        id: row.id,
        representantId: row.representant.id,
        shortCode: shortCode(row.representant.id),
        phoneE164: row.representant.phoneE164,
        outcome: row.outcome,
        promisedProspects: row.promisedProspects,
        comment: row.comment,
        performedById: row.performedById,
        performedByName: row.performedBy.fullName,
        assignedToId: row.task?.assignedToId ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private async progressByCampaign(ids: readonly string[]): Promise<ProgressIndex> {
    if (ids.length === 0) return new Map();

    const grouped = await this.prisma.repCallTask.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: [...ids] }, ...demoScope(await this.demo.enabled()) },
      _count: { _all: true },
    });

    const index: ProgressIndex = new Map();
    for (const row of grouped) tallyInto(index, row.campaignId, row.status, row._count._all);
    return index;
  }

  private async dayCounts(
    campaignId: string,
    spreadDays: number,
  ): Promise<{ overall: number[]; byUser: Map<string, number[]> }> {
    const grouped = await this.prisma.repCallTask.groupBy({
      by: ['assignedToId', 'dayIndex'],
      where: { campaignId, ...demoScope(await this.demo.enabled()) },
      _count: { _all: true },
    });

    const overall = zeroes(spreadDays);
    const byUser = new Map<string, number[]>();

    for (const row of grouped) {
      if (row.dayIndex < 0 || row.dayIndex >= overall.length) {
        this.logger.warn(
          `Campagne représentants ${campaignId} : ${String(row._count._all)} tâche(s) au ` +
            `jour ${String(row.dayIndex)}, hors des ${String(spreadDays)} journée(s) de la ` +
            `campagne. Lignes écartées du décompte par journée.`,
        );
        continue;
      }
      overall[row.dayIndex] = (overall[row.dayIndex] ?? 0) + row._count._all;

      const bucket = byUser.get(row.assignedToId) ?? zeroes(spreadDays);
      bucket[row.dayIndex] = (bucket[row.dayIndex] ?? 0) + row._count._all;
      byUser.set(row.assignedToId, bucket);
    }

    return { overall, byUser };
  }

  async close(id: string): Promise<RepCampaignDetailDto> {
    const demoEnabled = await this.demo.enabled();
    await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.repCallCampaign.findFirst({
        where: { id, ...demoScope(demoEnabled) },
        select: { status: true },
      });
      if (!campaign) throw repCampaignNotFound();
      if (campaign.status === CampaignStatus.CLOSED) return;

      await tx.repCallCampaign.update({
        where: { id },
        data: { status: CampaignStatus.CLOSED, closedAt: new Date() },
      });
      await tx.repCallTask.updateMany({
        where: { campaignId: id, isActive: true },
        data: { status: CallTaskStatus.CANCELLED, isActive: false },
      });
    });

    return this.get(id);
  }

  async programme(
    campaignId: string,
    userId: string,
    jour?: number,
  ): Promise<{
    campaignName: string;
    commercialName: string;
    segmentLabel: string;
    rows: ProgrammeRow[];
    dayNumber?: number;
    dayCount?: number;
  }> {
    const membership = await this.prisma.repCallCampaignCommercial.findUnique({
      where: { campaignId_userId: { campaignId, userId } },
      include: {
        campaign: {
          select: {
            name: true,
            spreadDays: true,
            onlyWithoutProspects: true,
            departement: { select: { name: true } },
            ief: { select: { name: true } },
          },
        },
        user: { select: { fullName: true } },
      },
    });

    if (!membership) throw programmeNotFound();

    const spreadDays = membership.campaign.spreadDays;
    const demoWhere = demoScope(await this.demo.enabled());

    const taskCount = await this.prisma.repCallTask.count({
      where: { campaignId, assignedToId: userId, ...demoWhere },
    });
    const effectiveDays = Math.max(1, Math.min(spreadDays, taskCount));

    if (jour !== undefined && (jour < 1 || jour > effectiveDays)) throw dayNotFound(effectiveDays);

    const tasks = await this.prisma.repCallTask.findMany({
      where: {
        campaignId,
        assignedToId: userId,
        ...demoWhere,
        ...(jour === undefined ? {} : { dayIndex: jour - 1 }),
      },
      orderBy: { position: 'asc' },
      select: { position: true, representant: { select: { id: true, phoneE164: true } } },
    });

    return {
      campaignName: membership.campaign.name,
      commercialName: membership.user.fullName,
      segmentLabel: composeScopeLabel(
        membership.campaign.departement?.name ?? null,
        membership.campaign.ief?.name ?? null,
        membership.campaign.onlyWithoutProspects,
      ),
      rows: tasks.map((task) => ({
        position: task.position,
        shortCode: shortCode(task.representant.id),
        phoneE164: task.representant.phoneE164,
      })),
      ...(jour === undefined ? {} : { dayNumber: jour, dayCount: effectiveDays }),
    };
  }

  async recordAttempt(
    user: AuthenticatedUser,
    body: CreateRepCallAttemptDto,
  ): Promise<RepCallAttemptResultDto> {
    const comment = body.comment?.trim() || null;
    if (body.outcome === RepCallOutcome.OTHER && comment === null) throw commentRequired();
    if (
      body.promisedProspects !== undefined &&
      body.outcome !== RepCallOutcome.PROSPECTS_PROMISED
    ) {
      throw promisedNotAllowed();
    }
    if (comment !== null && comment.length > COMMENT_MAX_LENGTH) throw commentRequired();

    const suggested = await this.resolveSuggested(user, body.suggestedPhone);

    const existing = await this.prisma.repCallAttempt.findUnique({
      where: { id: body.id },
      select: { id: true, taskId: true },
    });
    if (existing) {
      return {
        status: RepCallAttemptApplyStatus.DUPLICATE,
        attemptId: existing.id,
        taskId: existing.taskId,
        taskClosed: false,
        suggestion: suggested?.lookup ?? null,
      };
    }

    const demoEnabled = await this.demo.enabled();
    const representant = await this.prisma.representant.findFirst({
      where: { id: body.representantId, deletedAt: null, ...demoScope(demoEnabled) },
      select: {
        id: true,
        isDemo: true,
        relationStatus: true,
        whatsappStatus: true,
        whatsappE164: true,
      },
    });
    if (!representant) throw representantNotFound();

    const whatsapp = resolveWhatsappPatch(body, representant);

    const task = await this.prisma.repCallTask.findFirst({
      where: { representantId: body.representantId, isActive: true, ...demoScope(demoEnabled) },
      select: { id: true, campaignId: true },
      orderBy: { createdAt: 'asc' },
    });

    const terminal = TERMINAL_OUTCOMES.includes(body.outcome);

    const applied = await this.prisma.$transaction(async (tx) => {
      const inserted = await tx.repCallAttempt.createMany({
        data: [
          {
            id: body.id,
            representantId: body.representantId,
            taskId: task?.id ?? null,
            campaignId: task?.campaignId ?? null,
            performedById: user.id,
            outcome: body.outcome,
            promisedProspects: body.promisedProspects ?? null,
            comment,
            clientCreatedAt: new Date(body.clientCreatedAt),
            isDemo: representant.isDemo,
          },
        ],
        skipDuplicates: true,
      });

      if (inserted.count === 0) return false;

      if (suggested) {
        await tx.representantSuggestion.create({
          data: {
            sourceRepresentantId: body.representantId,
            suggestedName: body.suggestedName?.trim() || null,
            suggestedPhoneE164: suggested.lookup.phoneE164,
            note: body.suggestedNote?.trim() || null,
            suggestedById: user.id,
            resolvedRepresentantId: suggested.resolvedRepresentantId,
            sourceAttemptId: body.id,
            clientCreatedAt: new Date(body.clientCreatedAt),
            isDemo: representant.isDemo,
          },
        });
      }

      // Sous le même verrou d'idempotence que la suggestion : un rejeu s'arrête
      // au `return false` ci-dessus et n'écrit donc pas le WhatsApp deux fois.
      if (Object.keys(whatsapp).length > 0) {
        await tx.representant.update({
          where: { id: body.representantId },
          data: { ...whatsapp, rev: { increment: 1 } },
        });
      }

      if (body.relationStatus !== undefined) {
        // WEB en dur : aucune entrée de synchronisation mobile n'écrit de
        // tentative représentant, et laisser le canal se déclarer depuis le
        // corps de la requête permettrait à n'importe quel appelant de se faire
        // passer pour l'autre.
        await applyRelationChange(tx, {
          representantId: body.representantId,
          fromStatus: representant.relationStatus,
          toStatus: body.relationStatus,
          changedById: user.id,
          source: ChangeSource.WEB,
          isDemo: representant.isDemo,
        });
      }

      if (task && terminal) {
        await tx.repCallTask.updateMany({
          where: { representantId: body.representantId, isActive: true },
          data: {
            status: CallTaskStatus.DONE,
            isActive: false,
            completedAt: new Date(),
          },
        });
      }

      return true;
    });

    if (!applied) {
      return {
        status: RepCallAttemptApplyStatus.DUPLICATE,
        attemptId: body.id,
        taskId: task?.id ?? null,
        taskClosed: false,
        suggestion: suggested?.lookup ?? null,
      };
    }

    return {
      status: RepCallAttemptApplyStatus.APPLIED,
      attemptId: body.id,
      taskId: task?.id ?? null,
      taskClosed: Boolean(task) && terminal,
      suggestion: suggested?.lookup ?? null,
    };
  }

  /**
   * Le numéro suggéré n'est PAS enregistré comme représentant : `phoneE164` y
   * porte un index unique partiel, et une fiche jamais rencontrée le réserverait
   * au téléconseiller qui rencontrerait un jour cette personne pour de vrai.
   */
  private async resolveSuggested(
    user: AuthenticatedUser,
    phone: string | undefined,
  ): Promise<{ lookup: RepresentantLookupDto; resolvedRepresentantId: string | null } | null> {
    if (phone === undefined) return null;

    const lookup = await this.representants.lookup(user, phone);
    const known = await this.prisma.representant.findFirst({
      where: {
        phoneE164: lookup.phoneE164,
        deletedAt: null,
        ...demoScope(await this.demo.enabled()),
      },
      select: { id: true },
    });

    return { lookup, resolvedRepresentantId: known?.id ?? null };
  }

  private async scopeLabel(scope: ScopeInput): Promise<string> {
    const [departement, ief] = await Promise.all([
      scope.departementId
        ? this.prisma.departement.findUnique({
            where: { id: scope.departementId },
            select: { name: true },
          })
        : Promise.resolve(null),
      scope.iefId
        ? this.prisma.ief.findUnique({ where: { id: scope.iefId }, select: { name: true } })
        : Promise.resolve(null),
    ]);

    return composeScopeLabel(
      departement?.name ?? null,
      ief?.name ?? null,
      scope.onlyWithoutProspects ?? false,
    );
  }
}

function eligibleWhere(scope: ScopeInput, demoPopulation: boolean): Prisma.RepresentantWhereInput {
  return {
    deletedAt: null,
    isDemo: demoPopulation,
    ...(scope.departementId ? { departementId: scope.departementId } : {}),
    ...(scope.iefId ? { iefId: scope.iefId } : {}),
    ...(scope.onlyWithoutProspects ? { prospects: { none: { deletedAt: null } } } : {}),
    repCallTasks: { none: { isActive: true } },
    repCallAttempts: { none: { outcome: { in: [...TERMINAL_OUTCOMES] } } },
  };
}

function composeScopeLabel(
  departement: string | null,
  ief: string | null,
  onlyWithoutProspects: boolean,
): string {
  const parts: string[] = [];
  if (departement) parts.push(`Département ${departement}`);
  if (ief) parts.push(`IEF ${ief}`);
  if (onlyWithoutProspects) parts.push('sans prospect');
  return parts.length ? parts.join(', ') : 'Tous les représentants';
}

function translateWriteError(error: unknown): unknown {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  ) {
    return representantAlreadyAssigned();
  }
  return error;
}
