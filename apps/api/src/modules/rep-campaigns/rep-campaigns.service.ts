import { Injectable, Logger } from '@nestjs/common';
import { CallTaskStatus, CampaignStatus, Prisma, RepCallOutcome, Role } from '@crm/database';

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

/**
 * Campagnes d'appels aux REPRÉSENTANTS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UN MODULE SÉPARÉ ET PAS UN `kind` SUR CallCampaign
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La mécanique est la même (graine persistée, tourniquet, tâche par cible,
 * journal en ajout seul) mais le métier ne l'est pas : la cible est une autre
 * table, les issues d'appel sont différentes, et surtout la campagne prospects
 * porte l'invariant « une seule tâche active par prospect » dont dépend
 * l'éligibilité de toute la phase 2. Greffer les représentants dessus mettrait
 * cet invariant en jeu à chaque évolution du nouveau besoin, sur la
 * fonctionnalité qui porte aujourd'hui la collecte complète des méthodes.
 *
 * Ce qui est PARTAGÉ, en revanche, l'est réellement et pas par copie :
 * `distribution.ts` (tirage, tourniquet, étalement) et `programme-pdf.ts`
 * (maquette imprimée). Le même commercial reçoit les deux liasses le même
 * matin : elles doivent se ressembler au point près.
 */

const CAMPAIGN_TRANSACTION_TIMEOUT_MS = 120_000;
const CAMPAIGN_TRANSACTION_MAX_WAIT_MS = 15_000;

/** Taille des lots d'insertion. Même raison que côté prospects : la taille de requête. */
const TASK_INSERT_CHUNK = 5_000;

/** Nombre de tentatives affichées dans le détail d'une campagne. */
const RECENT_ATTEMPTS = 20;

/**
 * Issues qui CLÔTURENT la tâche.
 *
 * `CALLBACK` et `UNREACHABLE` la laissent ouverte, par construction : elles
 * décrivent un appel à refaire. `OTHER` la laisse ouverte aussi, parce qu'elle
 * ne dit rien de l'aboutissement, seulement qu'il s'est passé quelque chose.
 */
const TERMINAL_OUTCOMES: readonly RepCallOutcome[] = [
  RepCallOutcome.REACHED,
  RepCallOutcome.PROSPECTS_PROMISED,
  RepCallOutcome.REFUSED,
  RepCallOutcome.WRONG_NUMBER,
];

/**
 * Cases du programme papier des représentants.
 *
 * Deux rangées comme du côté prospects, pour que la liasse se remplisse avec le
 * même geste : ce que l'appel a donné, puis pourquoi il n'a rien donné.
 */
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
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Création
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Crée une campagne, tire l'ensemble éligible et MATÉRIALISE la répartition.
   *
   * Tout tient dans une seule transaction, pour la même raison que côté
   * prospects : une campagne sans tâches paraît valide à l'écran, ses
   * programmes sortent vides, et les représentants concernés restent éligibles
   * pour une deuxième campagne qui les distribuerait à quelqu'un d'autre.
   */
  async create(user: AuthenticatedUser, body: CreateRepCampaignDto): Promise<RepCampaignDetailDto> {
    const commerciaux = await this.resolveCommerciaux(body.commercialIds);
    const seed = newCampaignSeed();
    const spreadDays = body.spreadDays ?? MIN_SPREAD_DAYS;
    // `enabledForWrite` : cette valeur est ÉCRITE sur la campagne, puis héritée
    // par ses tâches. Un repli `false` sur panne de lecture laisserait une
    // campagne fictive dans la liste réelle, programmes imprimables compris.
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
              // Une campagne créée pendant une démonstration EST de
              // démonstration. Sans ce drapeau, éteindre le mode laisse une
              // campagne fictive dans la liste réelle, avec ses tâches et ses
              // programmes imprimables.
              isDemo: demoEnabled,
            },
          });

          await tx.repCallCampaignCommercial.createMany({
            // L'ordre reçu EST le rang du tourniquet : c'est lui qui fige le
            // contenu de chaque programme, indépendamment de l'ordre de lecture
            // en base.
            data: commerciaux.map((commercial, index) => ({
              campaignId: campaign.id,
              userId: commercial.id,
              position: index + 1,
            })),
          });

          const eligible = await tx.representant.findMany({
            where: eligibleWhere(body, demoEnabled),
            select: { id: true },
            // Ordre d'entrée déterministe : sans lui, le mélange partirait d'une
            // permutation arbitraire et la graine ne rejouerait plus rien.
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
                // La tâche suit sa campagne. `eligibleWhere` ne mélange jamais
                // les deux populations, et la recopie garde la file d'appels
                // invisible en même temps que la campagne qui l'a produite.
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

  /**
   * Contrôle la liste de commerciaux AVANT d'ouvrir la transaction.
   *
   * Un compte désactivé ou d'un autre rôle recevrait un programme que personne
   * n'appellerait : les représentants seraient marqués « affectés », donc
   * exclus de toute campagne ultérieure, et dormiraient indéfiniment.
   */
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

    // On respecte l'ordre demandé, pas celui de la base.
    return ids.flatMap((id) => {
      const row = byId.get(id);
      if (!row) return [];
      return { id: row.id, fullName: row.fullName, username: row.username };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Aperçu
  // ───────────────────────────────────────────────────────────────────────────

  async preview(query: RepCampaignPreviewQueryDto): Promise<RepCampaignPreviewDto> {
    const eligible = await this.prisma.representant.count({
      where: eligibleWhere(query, await this.demo.enabled()),
    });

    const commercialCount = Math.max(1, query.commercialCount ?? 1);
    // Le plus gros lot, pas la moyenne : le tourniquet garantit un écart d'au
    // plus une ligne, et c'est le commercial le plus chargé qui décide si la
    // journée est tenable.
    const perCommercial = Math.ceil(eligible / commercialCount);

    return {
      eligible,
      perCommercial,
      perDay: dayHistogram(perCommercial, query.spreadDays ?? MIN_SPREAD_DAYS),
      scopeLabel: await this.scopeLabel(query),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lecture
  // ───────────────────────────────────────────────────────────────────────────

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

    // La campagne est déjà cloisonnée par la lecture ci-dessus, mais le filtre
    // est reposé sur chaque agrégat : une tâche de démonstration accrochée à
    // une campagne réelle gonflerait autrement l'avancement affiché.
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

  /** Lignes par journée, globalement et par commercial. Voir le service de phase 2. */
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
      // Même règle et même garde-fou que la phase 2 : on écarte l'indice hors
      // bornes (réduction légitime de `spreadDays`) mais on le JOURNALISE. La
      // contrainte en base ne borne que `dayIndex >= 0`, donc un indice absurde
      // passe à l'écriture et disparaît ici, en laissant un total par journée
      // inférieur au nombre de tâches sans le moindre signal.
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

  // ───────────────────────────────────────────────────────────────────────────
  // Clôture
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Clôt la campagne et ANNULE toutes les tâches encore ouvertes.
   *
   * `isActive` retombe à faux : c'est cette colonne qui porte l'index unique
   * partiel. Sans cette remise à zéro, les représentants non appelés
   * resteraient inéligibles à toute campagne future, pour toujours.
   *
   * Idempotent : un bouton « Clôturer » cliqué deux fois est un geste banal.
   */
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

  // ───────────────────────────────────────────────────────────────────────────
  // Programme d'un commercial
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Lignes du programme d'un commercial, DANS L'ORDRE PERSISTÉ.
   *
   * AUCUN NOM DE REPRÉSENTANT n'en sort, comme du côté prospects et pour la
   * même raison : une liasse imprimée circule, et un numéro accompagné d'un nom
   * constitue un fichier nominatif exploitable tel quel par qui le ramasse. Le
   * commercial rapproche la ligne de sa fiche par le code court.
   */
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

    // On ne distingue pas « campagne inexistante » de « ce commercial n'en fait
    // pas partie » : les deux appellent la même correction, et les séparer
    // révélerait l'existence de campagnes.
    if (!membership) throw programmeNotFound();

    const spreadDays = membership.campaign.spreadDays;
    const demoWhere = demoScope(await this.demo.enabled());

    // La borne est l'étalement EFFECTIF DE CE COMMERCIAL, pas `spreadDays`.
    // `dayIndexFor` plafonne l'indice à `min(spreadDays, taille de file) - 1` :
    // un commercial qui n'a reçu que 3 fiches dans une campagne étalée sur 7
    // jours n'a que trois journées. Comparer à `spreadDays` laissait passer
    // `?jour=5` et rendait le PDF vide que ce refus existe pour empêcher, un
    // document qui se lit comme « rien à faire aujourd'hui ».
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
      // `effectiveDays`, et non `spreadDays` : voir le même choix, expliqué, du
      // côté des campagnes prospects. Le pied de page doit annoncer les
      // journées de CE commercial, celles que le refus ci-dessus lui oppose.
      ...(jour === undefined ? {} : { dayNumber: jour, dayCount: effectiveDays }),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Tentatives
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Enregistre un appel et clôt la tâche si l'issue est terminale.
   *
   * L'IDEMPOTENCE EST PORTÉE PAR L'IDENTIFIANT CLIENT. Un réseau qui coupe
   * après l'écriture mais avant la réponse fait rejouer l'envoi : sans cette
   * garde, le même appel compterait deux fois et le taux de joignabilité
   * deviendrait faux sans que personne ne s'en aperçoive.
   */
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
      };
    }

    const demoEnabled = await this.demo.enabled();
    const representant = await this.prisma.representant.findFirst({
      where: { id: body.representantId, deletedAt: null, ...demoScope(demoEnabled) },
      // `isDemo` est lu ICI, sur la fiche appelée, et n'est jamais rendu au
      // client : le DTO de résultat ne porte pas la nature de la ligne. Il ne
      // sert qu'à l'écriture de la tentative, juste en dessous.
      select: { id: true, isDemo: true },
    });
    if (!representant) throw representantNotFound();

    // Une tentative SANS tâche reste enregistrée : un commercial peut rappeler
    // un représentant hors campagne, et perdre cette trace priverait les
    // statistiques de qualité de la base de la moitié de leur matière.
    //
    // `orderBy: createdAt` : l'index unique partiel n'admet qu'une tâche active
    // par représentant, mais l'ordre rend la lecture déterministe si cet index
    // venait à tomber, plutôt que de dépendre du plan de PostgreSQL. Miroir du
    // chemin prospects (`phase2-sync.service.ts`).
    const task = await this.prisma.repCallTask.findFirst({
      where: { representantId: body.representantId, isActive: true, ...demoScope(demoEnabled) },
      select: { id: true, campaignId: true },
      orderBy: { createdAt: 'asc' },
    });

    const terminal = TERMINAL_OUTCOMES.includes(body.outcome);

    const applied = await this.prisma.$transaction(async (tx) => {
      // `createMany({ skipDuplicates })` et non `create` : la lecture
      // d'idempotence ci-dessus n'est qu'un raccourci, deux envois simultanés
      // du même identifiant la franchissent tous les deux. `create` faisait
      // alors remonter un P2002 que rien ne traduit, donc un 500 sur un rejeu
      // réseau, c'est-à-dire sur le cas le plus banal du terrain. La variante
      // « ne rien faire en cas de conflit » tranche en base et rend le compte
      // écrit. Miroir exact du chemin prospects.
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
            // LA FICHE APPELÉE, ET NON L'INTERRUPTEUR. Le commentaire disait
            // déjà « la tentative suit le représentant » pendant que le code
            // recopiait l'état global : un appel RÉEL passé pendant qu'un
            // administrateur montrait la plateforme partait donc en
            // `isDemo: true`, et deux dégâts s'ensuivaient.
            //
            // Le premier est la disparition : mode éteint, la tentative n'est
            // plus lue nulle part, et l'historique de l'appel est perdu pour
            // le commercial qui l'a passé.
            //
            // Le second est pire, parce qu'il est DURABLE. `eligibleWhere`
            // exclut définitivement un représentant porteur d'une issue
            // terminale, et cette clause-là n'est PAS bornée par `isDemo` : la
            // fiche restait donc inéligible à toute campagne future, sans
            // qu'aucun écran ne montre plus pourquoi. Refus invisible et
            // exclusion perpétuelle, sur un appel parfaitement légitime.
            //
            // Miroir exact du chemin prospects, `phase2-sync.service.ts`, qui
            // écrit `isDemo: prospect.isDemo`.
            isDemo: representant.isDemo,
          },
        ],
        skipDuplicates: true,
      });

      if (inserted.count === 0) return false;

      if (task && terminal) {
        // `updateMany` sur TOUTES les tâches actives, et non `update` sur la
        // seule qui a été lue : si l'index unique partiel venait à manquer, une
        // seconde tâche active resterait ouverte pour toujours et son
        // représentant serait inéligible à vie. `isActive: true` dans le
        // `where` interdit en prime de rouvrir une tâche qu'une clôture de
        // campagne concurrente vient d'annuler.
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
      };
    }

    return {
      status: RepCallAttemptApplyStatus.APPLIED,
      attemptId: body.id,
      taskId: task?.id ?? null,
      taskClosed: Boolean(task) && terminal,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────

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

/**
 * Représentants éligibles à une campagne.
 *
 * `repCallTasks: { none: { isActive: true } }` est la condition qui interdit de
 * distribuer deux fois le même numéro. Elle double l'index unique partiel :
 * l'index protège la base, cette clause évite d'écrire 40 000 lignes pour se
 * heurter au conflit sur la dernière.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UNE ISSUE TERMINALE SORT LE REPRÉSENTANT DE LA POPULATION, DÉFINITIVEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `isActive` ne suffit pas : la tâche retombe à faux DÈS que l'appel aboutit,
 * qu'il ait donné « refus » ou « faux numéro ». Sans cette seconde condition,
 * la personne qui a dit non redevient éligible le lendemain, entre dans la
 * campagne suivante, redit non, et recommence indéfiniment. C'est la campagne
 * de relance qui se transforme en harcèlement, et le faux numéro qui se fait
 * recomposer à chaque tirage.
 *
 * Les issues NON terminales (`CALLBACK`, `UNREACHABLE`, `OTHER`) ne ferment
 * rien, par construction : elles décrivent un appel à refaire, et c'est
 * exactement la population qu'une relance doit retrouver.
 */
function eligibleWhere(scope: ScopeInput, demoPopulation: boolean): Prisma.RepresentantWhereInput {
  return {
    deletedAt: null,
    // UNE SEULE POPULATION, et non `demoScope`, qui ÉLARGIT quand le mode est
    // allumé. Voir l'explication complète dans `eligibleForCampaignWhere`
    // (packages/database/src/segment.ts) : un tirage matérialise des tâches
    // durables et exclut les fiches retenues des campagnes suivantes. Mêler
    // les deux populations laissait des représentants réels bloqués par une
    // tâche de démonstration invisible, que la purge ne sait pas reprendre.
    isDemo: demoPopulation,
    ...(scope.departementId ? { departementId: scope.departementId } : {}),
    ...(scope.iefId ? { iefId: scope.iefId } : {}),
    ...(scope.onlyWithoutProspects ? { prospects: { none: { deletedAt: null } } } : {}),
    // VOLONTAIREMENT NON BORNÉS PAR `isDemo`, contrairement au filtre de
    // population ci-dessus. `rep_call_tasks_one_active_per_representant` est
    // partiel sur `isActive = true` et ignore `isDemo` : la base n'admet
    // qu'une tâche active par représentant, toutes populations confondues.
    // Une clause plus étroite que cet index laisserait passer un représentant
    // porteur d'une tâche active de l'autre population, et le tirage se
    // heurterait au conflit d'unicité au lieu de l'éviter. Voir la même
    // décision, expliquée, dans `eligibleForCampaignWhere`.
    repCallTasks: { none: { isActive: true } },
    repCallAttempts: { none: { outcome: { in: [...TERMINAL_OUTCOMES] } } },
  };
}

/** Libellé lisible du périmètre, composé une seule fois pour l'écran et le PDF. */
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
