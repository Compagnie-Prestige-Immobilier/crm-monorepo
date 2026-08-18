import {
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
  ScheduledCallbackStatus,
  eligibleForCampaignWhere,
} from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { shortCode } from '../../common/short-code.js';
import { isAdmin } from '../../common/scope.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import {
  MIN_SPREAD_DAYS,
  dayIndexFor,
  distributeRoundRobin,
  newCampaignSeed,
  shuffleInPostgres,
} from './distribution.js';
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
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';

/** Bornes de transaction pour matérialiser une grande campagne. */
const CAMPAIGN_TRANSACTION_TIMEOUT_MS = 120_000;
const CAMPAIGN_TRANSACTION_MAX_WAIT_MS = 15_000;

/** Évite les instructions d'insertion de plusieurs mégaoctets. */
const TASK_INSERT_CHUNK = 5_000;

/** Nombre de tentatives récentes affichées dans le détail. */
const RECENT_ATTEMPTS = 20;

/** Libellé lisible du périmètre de campagne. */
export function scopeLabel(scope: CampaignScope): string {
  // ALL n'a pas de libellé de segment : les quatre segments réunis FORMENT la
  // base, sans recouvrement ni trou (voir `segment.ts`).
  return scope === CampaignScope.ALL ? 'Toutes bases, BDD1 à BDD4' : SEGMENT_LABELS[scope];
}

const emptyProgress = (): CampaignProgressDto => ({ total: 0, open: 0, done: 0, cancelled: 0 });

/** Histogramme vide, contenant toujours le jour 1. */
const zeroes = (length: number): number[] => Array.from({ length: Math.max(1, length) }, () => 0);

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  // Création

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
    const spreadDays = body.spreadDays ?? MIN_SPREAD_DAYS;
    // `enabledForWrite` : cette valeur est ÉCRITE sur la campagne, puis héritée
    // par ses tâches. Un repli `false` sur panne de lecture laisserait une
    // campagne fictive dans la liste réelle, programmes imprimables compris.
    const demoEnabled = await this.demo.enabledForWrite();

    const campaignId = await this.prisma
      .$transaction(
        async (tx) => {
          const campaign = await tx.callCampaign.create({
            data: {
              name: body.name.trim(),
              scope: body.scope,
              seed,
              spreadDays,
              createdById: user.id,
              // Une campagne créée pendant une démonstration EST de
              // démonstration. Sans ce drapeau, éteindre le mode laisse une
              // campagne fictive dans la liste réelle, avec ses tâches et ses
              // programmes imprimables.
              isDemo: demoEnabled,
            },
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
            where: eligibleForCampaignWhere(body.scope, demoEnabled),
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

          // Taille de la file de CHAQUE commercial, connue seulement une fois
          // le tourniquet passé. L'étalement s'y applique ensuite : découper
          // avant la distribution donnerait des journées de tailles inégales
          // d'un commercial à l'autre.
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
                prospectId: assignment.item,
                assignedToId: commercial.id,
                position: assignment.position,
                dayIndex: dayIndexFor(
                  assignment.position,
                  queueSize[assignment.bucket] ?? 0,
                  spreadDays,
                ),
                // La tâche suit sa campagne. Le tirage ne mélange jamais les
                // deux populations (voir `eligibleForCampaignWhere`), et la
                // recopie ici garde la file d'appels invisible en même temps
                // que la campagne qui l'a produite.
                isDemo: demoEnabled,
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
   * n'appellerait : les prospects seraient marqués « affectés », donc exclus
   * de toute campagne ultérieure, et dormiraient indéfiniment.
   *
   * ═══ CE N'EST PAS UNE LECTURE, C'EST UNE ADMISSION ═══
   *
   * `demoScope` manquait ici, alors que le module jumeau des campagnes
   * représentants le composait déjà. La dissymétrie n'était pas anodine : mode
   * ÉTEINT, un POST portant l'UUID d'un compte de démonstration était ACCEPTÉ,
   * puisque ce compte a bien le rôle COMMERCIAL et qu'il est actif. La campagne
   * créée était RÉELLE, mais ses adhésions et ses tâches pointaient vers des
   * comptes que plus aucun écran ne montre, et `onDelete: Restrict` sur les
   * deux relations bloquait ensuite la purge de démonstration.
   *
   * La dispense écrite dans le balayage de visibilité, « relecture par lot de
   * clés primaires », est juste pour ce qu'elle vise, empêcher une FUITE : ces
   * identifiants viennent du client, ils ne révèlent rien. Elle ne dit rien du
   * cas inverse, ADMETTRE une ligne fictive dans une écriture réelle, et c'est
   * pourtant le même appel qui décide des deux.
   */
  private async resolveCommerciaux(
    ids: readonly string[],
  ): Promise<{ id: string; fullName: string; username: string }[]> {
    const found = await this.prisma.user.findMany({
      where: {
        id: { in: [...ids] },
        deletedAt: null,
        ...demoScope(await this.demo.enabled()),
      },
      select: { id: true, fullName: true, username: true, role: true, isActive: true },
    });

    const byId = new Map(found.map((row) => [row.id, row]));

    // 422 et non 400 : la requête est BIEN FORMÉE, elle est refusée pour une
    // raison métier. Un identifiant valide qui ne désigne aucun compte, un
    // compte au mauvais rôle ou un compte désactivé ne sont pas des fautes de
    // syntaxe. Le module des demandes clients tranchait déjà ainsi, et deux
    // statuts pour la même classe de faute obligeaient chaque client à savoir
    // de quel module venait l'erreur avant de pouvoir la traiter.
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'PHASE2_COMMERCIAL_NOT_FOUND',
        message: 'Un ou plusieurs comptes destinataires sont introuvables.',
        userIds: missing,
      });
    }

    const notCommercial = ids.filter((id) => byId.get(id)?.role !== Role.COMMERCIAL);
    if (notCommercial.length > 0) {
      throw new UnprocessableEntityException({
        code: 'PHASE2_NOT_A_COMMERCIAL',
        message: 'Seuls des comptes COMMERCIAL peuvent recevoir un programme d’appels.',
        userIds: notCommercial,
      });
    }

    const inactive = ids.filter((id) => byId.get(id)?.isActive !== true);
    if (inactive.length > 0) {
      throw new UnprocessableEntityException({
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

  // Lecture

  /**
   * Liste des campagnes. CLOISONNÉE pour un non-administrateur.
   *
   * Un téléconseiller ne voit que les campagnes où il a des tâches, et leur
   * `progress` compte SES tâches, pas celles de l'équipe : ouvrir cette lecture
   * pour lui rendre un sélecteur de campagne ne doit pas lui livrer au passage
   * la production de ses collègues.
   */
  async list(user: AuthenticatedUser, query: CampaignQueryDto): Promise<CampaignListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const search = query.search?.trim();
    const assignedToId = isAdmin(user) ? undefined : user.id;
    const where: Prisma.CallCampaignWhereInput = {
      ...demoScope(await this.demo.enabled()),
      ...(assignedToId === undefined ? {} : { tasks: { some: { assignedToId } } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.scope ? { scope: query.scope } : {}),
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

    const progress = await this.progressByCampaign(
      campaigns.map((row) => row.id),
      assignedToId,
    );

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
        spreadDays: row.spreadDays,
        progress: progress.get(row.id) ?? emptyProgress(),
        createdAt: row.createdAt.toISOString(),
        closedAt: row.closedAt?.toISOString() ?? null,
      })),
      // `Math.max(1, ...)` : une liste vide reste UNE page, vide. Rendre 0
      // ici et 1 dans les campagnes représentants, les dossiers bancaires et
      // les demandes clients obligeait chaque écran à savoir de quelle liste
      // il vient pour décider si « page 1 sur 0 » est normal.
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async get(id: string): Promise<CampaignDetailDto> {
    // CLOISONNÉE, comme la LISTE juste au-dessus. Une résolution par clé
    // primaire semble inoffensive, elle ne l'est pas : l'identifiant d'une
    // campagne de démonstration reste dans l'historique du navigateur, dans un
    // signet et dans un lien collé en conversation. Sans ce filtre, le mode
    // éteint, la campagne fictive s'ouvrait quand même, et ses chiffres
    // passaient pour des chiffres de production.
    //
    // Le balayage `demo-visibility.sweep.test.ts` ne dénonce pas ce site : il
    // tient une lecture par `id` pour une résolution d'entité et la dispense,
    // délibérément. Le module campagnes REPRÉSENTANTS cloisonnait déjà
    // (`rep-campaigns.service.ts`, `get`) ; les deux modules divergeaient sur
    // la même question.
    const campaign = await this.prisma.callCampaign.findFirst({
      where: { id, ...demoScope(await this.demo.enabled()) },
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

    // LECTURE GLOBALE : l'avancement d'une campagne DÉJÀ résolue par sa clé
    // primaire juste au-dessus. Filtrer les tâches ici ferait afficher un
    // avancement partiel sur une campagne pourtant visible en entier.
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

    // Répartition par journée, LUE en base et non recalculée. Rejouer
    // `dayIndexFor` ici ferait exister une seconde vérité : le jour affiché à
    // l'écran cesserait de correspondre au contenu du PDF dès qu'une tâche
    // serait déplacée à la main.
    const perDay = await this.dayCounts(id, campaign.spreadDays);

    // LECTURE GLOBALE : les dernières tentatives de cette MÊME campagne, elle
    // aussi déjà résolue par sa clé primaire.
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
      spreadDays: campaign.spreadDays,
      progress: overall,
      createdAt: campaign.createdAt.toISOString(),
      closedAt: campaign.closedAt?.toISOString() ?? null,
      perDay: perDay.overall,
      commerciaux: campaign.commerciaux.map((row): CampaignCommercialDto => ({
        userId: row.user.id,
        fullName: row.user.fullName,
        username: row.user.username,
        position: row.position,
        progress: perCommercial.get(row.user.id) ?? emptyProgress(),
        perDay: perDay.byUser.get(row.user.id) ?? zeroes(campaign.spreadDays),
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

  /**
   * Lignes par journée, globalement et par commercial.
   *
   * Une seule agrégation pour les deux : la ventilation par commercial se
   * réduit ensuite, plutôt que de repasser une requête par personne, sur une
   * campagne à quarante commerciaux, l'écran de détail ferait quarante allers
   * et retours pour un tableau qui tient en une ligne de SQL.
   */
  private async dayCounts(
    campaignId: string,
    spreadDays: number,
  ): Promise<{ overall: number[]; byUser: Map<string, number[]> }> {
    const grouped = await this.prisma.callTask.groupBy({
      by: ['assignedToId', 'dayIndex'],
      where: { campaignId, ...demoScope(await this.demo.enabled()) },
      _count: { _all: true },
    });

    const overall = zeroes(spreadDays);
    const byUser = new Map<string, number[]>();

    for (const row of grouped) {
      // Une campagne ancienne peut porter un `dayIndex` hors des bornes
      // actuelles si `spreadDays` a été réduit après coup : on ignore plutôt
      // que d'agrandir le tableau, qui doit rester aligné sur les boutons PDF.
      //
      // Mais on ne l'ignore plus EN SILENCE. La contrainte en base ne borne
      // que `dayIndex >= 0` : un indice de 999 sur une campagne de trois jours
      // est accepté à l'écriture, puis écarté ici, et la somme des journées
      // devient inférieure au nombre de tâches sans que rien ne le signale.
      // Une réduction légitime de `spreadDays` et une corruption d'indice
      // avaient exactement la même trace, c'est à dire aucune.
      if (row.dayIndex < 0 || row.dayIndex >= overall.length) {
        this.logger.warn(
          `Campagne ${campaignId} : ${String(row._count._all)} tâche(s) au jour ` +
            `${String(row.dayIndex)}, hors des ${String(spreadDays)} journée(s) de la ` +
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

  private async progressByCampaign(
    ids: readonly string[],
    assignedToId?: string,
  ): Promise<Map<string, CampaignProgressDto>> {
    if (ids.length === 0) return new Map();

    const grouped = await this.prisma.callTask.groupBy({
      by: ['campaignId', 'status'],
      where: {
        campaignId: { in: [...ids] },
        ...(assignedToId === undefined ? {} : { assignedToId }),
        ...demoScope(await this.demo.enabled()),
      },
      _count: { _all: true },
    });

    const index: ProgressIndex = new Map();
    for (const row of grouped) tallyInto(index, row.campaignId, row.status, row._count._all);
    return index;
  }

  // Clôture

  /**
   * Clôt la campagne et ANNULE toutes les tâches encore ouvertes.
   *
   * `isActive` retombe à faux : c'est cette colonne qui porte l'index unique
   * partiel. Sans cette remise à zéro, les prospects non appelés resteraient
   * bloqués, inéligibles à toute campagne future, pour toujours.
   *
   * L'opération est idempotente : un second appel ne change rien et ne renvoie
   * pas d'erreur. Un bouton « Clôturer » cliqué deux fois est un geste banal,
   * pas une faute à signaler.
   */
  async close(id: string): Promise<CampaignDetailDto> {
    const demoEnabled = await this.demo.enabled();
    await this.prisma.$transaction(async (tx) => {
      // CLOISONNÉE, et ici la lecture décide d'une ÉCRITURE. Sans le filtre,
      // le mode éteint, un identifiant conservé dans un signet permettait
      // d'annuler pour de bon les tâches d'une campagne de démonstration :
      // une mutation sur des lignes que la plateforme prétend ne pas voir.
      // Miroir de `rep-campaigns.service.ts`, `close`.
      const campaign = await tx.callCampaign.findFirst({
        where: { id, ...demoScope(demoEnabled) },
        select: { status: true },
      });
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
      await tx.scheduledCallback.updateMany({
        where: { campaignId: id, status: ScheduledCallbackStatus.PENDING },
        data: { status: ScheduledCallbackStatus.CANCELLED },
      });
    });

    return this.get(id);
  }

  // Programme d'un commercial

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
    jour?: number,
  ): Promise<{
    campaignName: string;
    commercialName: string;
    segmentLabel: string;
    rows: ProgrammeRow[];
    dayNumber?: number;
    dayCount?: number;
  }> {
    const membership = await this.prisma.callCampaignCommercial.findUnique({
      where: { campaignId_userId: { campaignId, userId } },
      include: {
        campaign: { select: { name: true, scope: true, spreadDays: true } },
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

    const spreadDays = membership.campaign.spreadDays;

    // Une journée demandée au-delà de l'étalement est un refus, pas un
    // programme vide : un PDF de zéro ligne se lit comme « ce commercial n'a
    // rien à faire », ce qui est un contresens.
    //
    // La borne est l'étalement EFFECTIF DE CE COMMERCIAL, pas `spreadDays`.
    // `dayIndexFor` plafonne l'indice à `min(spreadDays, taille de file) - 1` :
    // un commercial qui n'a reçu que 3 fiches dans une campagne étalée sur 7
    // jours n'a que trois journées, et les jours 4 à 7 ne portent aucune ligne.
    // Comparer à `spreadDays` laissait donc passer `?jour=5` et rendait
    // exactement le PDF vide que ce refus existe pour empêcher.
    const demoWhere = demoScope(await this.demo.enabled());
    const taskCount = await this.prisma.callTask.count({
      where: { campaignId, assignedToId: userId, ...demoWhere },
    });
    const effectiveDays = Math.max(1, Math.min(spreadDays, taskCount));

    if (jour !== undefined && (jour < 1 || jour > effectiveDays)) {
      throw new NotFoundException({
        code: 'PHASE2_CAMPAIGN_DAY_NOT_FOUND',
        message: `Le programme de ce commercial tient sur ${String(effectiveDays)} journée(s).`,
      });
    }

    const tasks = await this.prisma.callTask.findMany({
      where: {
        campaignId,
        assignedToId: userId,
        ...demoWhere,
        ...(jour === undefined ? {} : { dayIndex: jour - 1 }),
      },
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
      // `effectiveDays`, et non `spreadDays` : le pied de page annonce le
      // nombre de journées de CE commercial, celui-là même que le refus
      // ci-dessus lui oppose. Imprimer « Jour 3 sur 7 » sur un programme qui
      // n'a que trois journées enverrait le téléconseiller réclamer quatre
      // feuilles qui n'existent pas, et le serveur les lui refuserait.
      ...(jour === undefined ? {} : { dayNumber: jour, dayCount: effectiveDays }),
    };
  }
}

/**
 * Traduit les violations de contraintes du tirage en réponses exploitables.
 *
 * Sans cela, deux administrateurs qui créent une campagne en même temps
 * reçoivent un 500 : l'un des deux tirages a bien été refusé par l'index unique
 * partiel `call_tasks_one_active_per_prospect`, ce qui est exactement le
 * comportement voulu, mais rien ne le dit à l'appelant.
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
