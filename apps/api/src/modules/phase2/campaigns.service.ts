import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CallTaskStatus,
  CampaignScope,
  CampaignStatus,
  Prisma,
  Role,
  SEGMENT_LABELS,
  eligibleForCampaignWhere,
} from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { shortCode } from '../../common/short-code.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { distributeRoundRobin, newCampaignSeed, toPostgresSeed } from './distribution.js';
import type { ProgrammeRow } from './programme-pdf.js';
import type {
  CampaignCommercialDto,
  CampaignDetailDto,
  CampaignListDto,
  CampaignProgressDto,
  CampaignQueryDto,
  CampaignSummaryDto,
  CreateCampaignDto,
} from './dto.js';

/**
 * Le tirage d'une campagne écrit autant de lignes qu'il y a de prospects
 * éligibles — jusqu'à plusieurs centaines de milliers. Le délai par défaut de
 * Prisma (5 s) l'interromprait au milieu ; on l'élargit franchement, mais
 * borné : une transaction qui dépasse cette limite est un incident, pas une
 * lenteur à absorber.
 */
const CAMPAIGN_TRANSACTION_TIMEOUT_MS = 120_000;
const CAMPAIGN_TRANSACTION_MAX_WAIT_MS = 15_000;

/**
 * Taille des lots d'insertion des tâches. Une seule instruction pour 500 000
 * lignes construirait une requête de plusieurs dizaines de mégaoctets côté
 * client comme côté serveur.
 */
const TASK_INSERT_CHUNK = 5_000;

/** Nombre de tentatives affichées dans le détail d'une campagne. */
const RECENT_ATTEMPTS = 20;

/** Libellé lisible d'un périmètre de campagne. */
export function scopeLabel(scope: CampaignScope): string {
  // ALL n'a pas de libellé de segment : les quatre segments réunis FORMENT la
  // base, sans recouvrement ni trou (voir `segment.ts`).
  return scope === CampaignScope.ALL ? 'Toutes bases — BDD1 à BDD4' : SEGMENT_LABELS[scope];
}

const emptyProgress = (): CampaignProgressDto => ({ total: 0, open: 0, done: 0, cancelled: 0 });

type ProgressIndex = Map<string, CampaignProgressDto>;

function tally(progress: CampaignProgressDto, status: CallTaskStatus, count: number): void {
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

@Injectable()
export class Phase2CampaignsService {
  private readonly logger = new Logger(Phase2CampaignsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Création
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Crée une campagne, tire l'ensemble éligible et MATÉRIALISE la répartition.
   *
   * Tout tient dans une seule transaction. Une création partielle serait pire
   * qu'un échec : une campagne sans tâches paraît valide à l'écran, ses
   * programmes sortent vides, et les prospects concernés restent éligibles pour
   * une deuxième campagne qui les distribuerait à quelqu'un d'autre.
   */
  async create(user: AuthenticatedUser, body: CreateCampaignDto): Promise<CampaignDetailDto> {
    const commerciaux = await this.resolveCommerciaux(body.commercialIds);
    const seed = newCampaignSeed();

    const campaignId = await this.prisma
      .$transaction(
        async (tx) => {
          const campaign = await tx.callCampaign.create({
            data: { name: body.name.trim(), scope: body.scope, seed, createdById: user.id },
          });

          await tx.callCampaignCommercial.createMany({
            // L'ordre reçu EST le rang du tourniquet : c'est lui qui fige le
            // contenu de chaque programme, indépendamment de l'ordre de lecture
            // en base.
            data: commerciaux.map((commercial, index) => ({
              campaignId: campaign.id,
              userId: commercial.id,
              position: index + 1,
            })),
          });

          // L'ensemble éligible vient de la définition PARTAGÉE. Le retraduire en
          // SQL ici ferait exister une seconde définition de BDD1 : un PDF
          // « BDD1 » cesserait de correspondre au graphique « BDD1 ».
          const eligible = await tx.prospect.findMany({
            where: eligibleForCampaignWhere(body.scope),
            select: { id: true },
            // Ordre d'entrée déterministe : sans lui, le mélange partirait d'une
            // permutation arbitraire et la graine ne rejouerait plus rien.
            orderBy: { id: 'asc' },
          });

          if (eligible.length === 0) {
            throw new UnprocessableEntityException({
              code: 'PHASE2_NO_ELIGIBLE_PROSPECT',
              message:
                'Aucun prospect éligible sur ce périmètre : tous sont déjà traités ou déjà affectés à une campagne en cours.',
            });
          }

          const ordered = await shuffleInPostgres(
            tx,
            seed,
            eligible.map((row) => row.id),
          );

          const assignments = distributeRoundRobin(ordered, commerciaux.length);
          const rows = assignments.flatMap((assignment) => {
            const commercial = commerciaux[assignment.bucket];
            if (!commercial) return [];
            return [
              {
                campaignId: campaign.id,
                prospectId: assignment.item,
                assignedToId: commercial.id,
                position: assignment.position,
              },
            ];
          });

          for (let start = 0; start < rows.length; start += TASK_INSERT_CHUNK) {
            await tx.callTask.createMany({ data: rows.slice(start, start + TASK_INSERT_CHUNK) });
          }

          this.logger.log(
            `Campagne ${campaign.id} : ${String(rows.length)} tâches réparties entre ${String(commerciaux.length)} commerciaux`,
          );
          return campaign.id;
        },
        {
          timeout: CAMPAIGN_TRANSACTION_TIMEOUT_MS,
          maxWait: CAMPAIGN_TRANSACTION_MAX_WAIT_MS,
        },
      )
      .catch((error: unknown) => {
        throw translateCampaignWriteError(error);
      });

    return this.get(campaignId);
  }

  /**
   * Contrôle la liste de commerciaux AVANT d'ouvrir la transaction.
   *
   * Un compte désactivé ou d'un autre rôle recevrait un programme que personne
   * n'appellerait : les prospects seraient marqués « affectés » — donc exclus
   * de toute campagne ultérieure — et dormiraient indéfiniment.
   */
  private async resolveCommerciaux(
    ids: readonly string[],
  ): Promise<{ id: string; fullName: string; username: string }[]> {
    const found = await this.prisma.user.findMany({
      where: { id: { in: [...ids] }, deletedAt: null },
      select: { id: true, fullName: true, username: true, role: true, isActive: true },
    });

    const byId = new Map(found.map((row) => [row.id, row]));

    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'PHASE2_COMMERCIAL_NOT_FOUND',
        message: 'Un ou plusieurs comptes destinataires sont introuvables.',
        userIds: missing,
      });
    }

    const notCommercial = ids.filter((id) => byId.get(id)?.role !== Role.COMMERCIAL);
    if (notCommercial.length > 0) {
      throw new BadRequestException({
        code: 'PHASE2_NOT_A_COMMERCIAL',
        message: 'Seuls des comptes COMMERCIAL peuvent recevoir un programme d’appels.',
        userIds: notCommercial,
      });
    }

    const inactive = ids.filter((id) => byId.get(id)?.isActive !== true);
    if (inactive.length > 0) {
      throw new BadRequestException({
        code: 'PHASE2_COMMERCIAL_INACTIVE',
        message: 'Un ou plusieurs comptes destinataires sont désactivés.',
        userIds: inactive,
      });
    }

    // On respecte l'ordre demandé, pas celui de la base.
    return ids.flatMap((id) => {
      const row = byId.get(id);
      if (!row) return [];
      return { id: row.id, fullName: row.fullName, username: row.username };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lecture
  // ───────────────────────────────────────────────────────────────────────────

  async list(query: CampaignQueryDto): Promise<CampaignListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: Prisma.CallCampaignWhereInput = query.status ? { status: query.status } : {};

    const [total, campaigns] = await Promise.all([
      this.prisma.callCampaign.count({ where }),
      this.prisma.callCampaign.findMany({
        where,
        include: {
          createdBy: { select: { fullName: true } },
          _count: { select: { commerciaux: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const progress = await this.progressByCampaign(campaigns.map((row) => row.id));

    return {
      items: campaigns.map((row): CampaignSummaryDto => ({
        id: row.id,
        name: row.name,
        scope: row.scope,
        scopeLabel: scopeLabel(row.scope),
        status: row.status,
        seed: row.seed,
        createdById: row.createdById,
        createdByName: row.createdBy.fullName,
        commercialCount: row._count.commerciaux,
        progress: progress.get(row.id) ?? emptyProgress(),
        createdAt: row.createdAt.toISOString(),
        closedAt: row.closedAt?.toISOString() ?? null,
      })),
      meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) },
    };
  }

  async get(id: string): Promise<CampaignDetailDto> {
    const campaign = await this.prisma.callCampaign.findFirst({
      where: { id },
      include: {
        createdBy: { select: { fullName: true } },
        commerciaux: {
          orderBy: { position: 'asc' },
          include: { user: { select: { id: true, fullName: true, username: true } } },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException({
        code: 'PHASE2_CAMPAIGN_NOT_FOUND',
        message: 'Campagne introuvable.',
      });
    }

    const grouped = await this.prisma.callTask.groupBy({
      by: ['assignedToId', 'status'],
      where: { campaignId: id },
      _count: { _all: true },
    });

    const perCommercial: ProgressIndex = new Map();
    const overall = emptyProgress();
    for (const row of grouped) {
      tallyInto(perCommercial, row.assignedToId, row.status, row._count._all);
      tally(overall, row.status, row._count._all);
    }

    const attempts = await this.prisma.callAttempt.findMany({
      where: { campaignId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: RECENT_ATTEMPTS,
      include: {
        prospect: { select: { id: true, phoneE164: true } },
        performedBy: { select: { fullName: true } },
        task: { select: { assignedToId: true } },
      },
    });

    return {
      id: campaign.id,
      name: campaign.name,
      scope: campaign.scope,
      scopeLabel: scopeLabel(campaign.scope),
      status: campaign.status,
      seed: campaign.seed,
      createdById: campaign.createdById,
      createdByName: campaign.createdBy.fullName,
      commercialCount: campaign.commerciaux.length,
      progress: overall,
      createdAt: campaign.createdAt.toISOString(),
      closedAt: campaign.closedAt?.toISOString() ?? null,
      commerciaux: campaign.commerciaux.map((row): CampaignCommercialDto => ({
        userId: row.user.id,
        fullName: row.user.fullName,
        username: row.user.username,
        position: row.position,
        progress: perCommercial.get(row.user.id) ?? emptyProgress(),
      })),
      recentAttempts: attempts.map((row) => ({
        id: row.id,
        prospectId: row.prospect.id,
        shortCode: shortCode(row.prospect.id),
        phoneE164: row.prospect.phoneE164,
        outcome: row.outcome,
        method: row.method,
        comment: row.comment,
        performedById: row.performedById,
        performedByName: row.performedBy.fullName,
        assignedToId: row.task?.assignedToId ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private async progressByCampaign(
    ids: readonly string[],
  ): Promise<Map<string, CampaignProgressDto>> {
    if (ids.length === 0) return new Map();

    const grouped = await this.prisma.callTask.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: [...ids] } },
      _count: { _all: true },
    });

    const index: ProgressIndex = new Map();
    for (const row of grouped) tallyInto(index, row.campaignId, row.status, row._count._all);
    return index;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Clôture
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Clôt la campagne et ANNULE toutes les tâches encore ouvertes.
   *
   * `isActive` retombe à faux : c'est cette colonne qui porte l'index unique
   * partiel. Sans cette remise à zéro, les prospects non appelés resteraient
   * bloqués — inéligibles à toute campagne future, pour toujours.
   *
   * L'opération est idempotente : un second appel ne change rien et ne renvoie
   * pas d'erreur. Un bouton « Clôturer » cliqué deux fois est un geste banal,
   * pas une faute à signaler.
   */
  async close(id: string): Promise<CampaignDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.callCampaign.findFirst({ where: { id }, select: { status: true } });
      if (!campaign) {
        throw new NotFoundException({
          code: 'PHASE2_CAMPAIGN_NOT_FOUND',
          message: 'Campagne introuvable.',
        });
      }
      if (campaign.status === CampaignStatus.CLOSED) return;

      await tx.callCampaign.update({
        where: { id },
        data: { status: CampaignStatus.CLOSED, closedAt: new Date() },
      });
      await tx.callTask.updateMany({
        where: { campaignId: id, isActive: true },
        data: { status: CallTaskStatus.CANCELLED, isActive: false },
      });
    });

    return this.get(id);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Programme d'un commercial
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Lignes du programme d'un commercial, DANS L'ORDRE PERSISTÉ.
   *
   * L'ordre vient de `CallTask.position`, écrit une fois pour toutes à la
   * création : retélécharger un programme rend exactement le même document que
   * la première fois, même si l'ensemble éligible a changé entre-temps.
   */
  async programme(
    campaignId: string,
    userId: string,
  ): Promise<{
    campaignName: string;
    commercialName: string;
    segmentLabel: string;
    rows: ProgrammeRow[];
  }> {
    const membership = await this.prisma.callCampaignCommercial.findUnique({
      where: { campaignId_userId: { campaignId, userId } },
      include: {
        campaign: { select: { name: true, scope: true } },
        user: { select: { fullName: true } },
      },
    });

    if (!membership) {
      // On ne distingue pas « campagne inexistante » de « ce commercial n'en
      // fait pas partie » : les deux appellent la même correction côté
      // appelant, et les séparer révélerait l'existence de campagnes.
      throw new NotFoundException({
        code: 'PHASE2_CAMPAIGN_COMMERCIAL_NOT_FOUND',
        message: 'Aucun programme pour ce commercial dans cette campagne.',
      });
    }

    const tasks = await this.prisma.callTask.findMany({
      where: { campaignId, assignedToId: userId },
      orderBy: { position: 'asc' },
      select: { position: true, prospect: { select: { id: true, phoneE164: true } } },
    });

    return {
      campaignName: membership.campaign.name,
      commercialName: membership.user.fullName,
      segmentLabel: scopeLabel(membership.campaign.scope),
      rows: tasks.map((task) => ({
        position: task.position,
        shortCode: shortCode(task.prospect.id),
        phoneE164: task.prospect.phoneE164,
      })),
    };
  }
}

/**
 * Mélange déterministe, EXÉCUTÉ PAR POSTGRESQL.
 *
 * `setseed` fixe la suite pseudo-aléatoire de la SESSION ; les deux
 * instructions doivent donc partager la même connexion, ce que garantit la
 * transaction interactive. La même graine sur la même liste d'entrée rend
 * toujours la même permutation — c'est ce qui rend un tirage auditable.
 *
 * La liste transite en un unique paramètre JSON plutôt qu'en autant de
 * paramètres liés : au-delà de 65 535 paramètres, PostgreSQL refuse la requête,
 * et une campagne peut porter dix fois ce nombre de lignes.
 */
async function shuffleInPostgres(
  tx: Prisma.TransactionClient,
  seed: string,
  ids: readonly string[],
): Promise<string[]> {
  await tx.$executeRawUnsafe('SELECT 1 FROM (SELECT setseed($1)) AS seeded', toPostgresSeed(seed));

  const rows = await tx.$queryRawUnsafe<{ id: string }[]>(
    'SELECT value AS id FROM jsonb_array_elements_text($1::jsonb) AS value ORDER BY random()',
    JSON.stringify(ids),
  );

  /* c8 ignore next 3 -- filet de sécurité : une perte de ligne ici passerait
     inaperçue et amputerait silencieusement la campagne. */
  if (rows.length !== ids.length) {
    throw new Error('Mélange incohérent : le nombre de lignes a changé pendant le tirage.');
  }

  return rows.map((row) => row.id);
}

/**
 * Traduit les violations de contraintes du tirage en réponses exploitables.
 *
 * Sans cela, deux administrateurs qui créent une campagne en même temps
 * reçoivent un 500 : l'un des deux tirages a bien été refusé par l'index unique
 * partiel `call_tasks_one_active_per_prospect` — ce qui est exactement le
 * comportement voulu — mais rien ne le dit à l'appelant.
 */
function translateCampaignWriteError(error: unknown): unknown {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  ) {
    return new ConflictException({
      code: 'PHASE2_PROSPECT_ALREADY_ASSIGNED',
      message:
        'Des prospects de ce périmètre viennent d’être affectés à une autre campagne. Relancez la création : ils en seront exclus.',
    });
  }
  return error;
}
