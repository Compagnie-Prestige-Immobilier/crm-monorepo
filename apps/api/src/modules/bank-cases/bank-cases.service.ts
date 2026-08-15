import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Phase2Status, Prisma } from '@crm/database';
import type { BankRejectionReason } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service.js';
import { tryNormalizePhone } from '../../common/phone.js';
import { isPrismaKnownError } from '../../common/filters/prisma-exception.filter.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { BANK_CASE_FROM, bankCaseConditions, bankCaseOrderBy } from './bank-cases.sql.js';
import {
  BANK_CASE_INCLUDE,
  BANK_TRANSITION_INCLUDE,
  isTerminalStage,
  toBankCaseDto,
  toReasonDto,
  toTransitionDto,
} from './mappers.js';
import type { BankCaseRow } from './mappers.js';
import { toDecimal } from './money.js';
import { normalizeReferenceDisplay, normalizeReferenceKey } from './reference-key.js';
import { assertReachable, planTransitionEffect } from './workflow.js';
import {
  BankCaseError,
  bankNotFound,
  caseNotFound,
  prospectNotEnrolled,
  prospectNotFound,
  referenceConflict,
  revConflict,
  stageNotFound,
  terminalCase,
} from './errors.js';
import type {
  BankCaseDetailDto,
  BankCaseDto,
  BankCaseListDto,
  BankCaseQueryDto,
  BankRejectionReasonListDto,
  CreateBankCaseCorrectionDto,
  CreateBankCaseDto,
  CreateBankCaseTransitionDto,
  ProspectSearchListDto,
  ProspectSearchQueryDto,
  UpdateBankCaseDto,
} from './dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SEARCH_PAGE_SIZE = 20;

/** Sentinelle interne : la transaction n'a rien mis à jour, la révision a bougé. */
const REV_MISMATCH = Symbol('rev-mismatch');

@Injectable()
export class BankCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  /**
   * Liste paginée.
   *
   * Les identifiants sont sélectionnés par la MÊME requête SQL que les
   * agrégats, puis hydratés par Prisma. C'est un aller-retour de plus, et c'est
   * délibéré : il n'existe ainsi qu'une seule définition du filtre, donc aucune
   * possibilité que le tableau et le tableau de bord décrivent des ensembles
   * différents.
   */
  async list(query: BankCaseQueryDto): Promise<BankCaseListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = bankCaseConditions(query, await this.demo.enabled());
    const orderBy = bankCaseOrderBy(query.sortBy, query.sortOrder);

    const [ids, totals] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT c."id" ${BANK_CASE_FROM} WHERE ${where} ${orderBy}
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total ${BANK_CASE_FROM} WHERE ${where}
      `,
    ]);

    const total = totals[0]?.total ?? 0;
    const rows = await this.prisma.bankCase.findMany({
      where: { id: { in: ids.map((row) => row.id) } },
      include: BANK_CASE_INCLUDE,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    return {
      items: ids
        .map((row) => byId.get(row.id))
        .filter((row): row is BankCaseRow => row !== undefined)
        .map(toBankCaseDto),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async get(id: string): Promise<BankCaseDetailDto> {
    const row = await this.loadCase(id);
    // LECTURE GLOBALE : l'historique d'un dossier DÉJÀ résolu par sa clé
    // primaire juste au-dessus. Le cloisonnement s'est joué sur le dossier ;
    // le rejouer ici rendrait une fiche sans son historique, ce qui se lirait
    // à l'écran comme un dossier jamais traité.
    const history = await this.prisma.bankCaseTransition.findMany({
      where: { caseId: id },
      include: BANK_TRANSITION_INCLUDE,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return { bankCase: toBankCaseDto(row), history: history.map(toTransitionDto) };
  }

  /**
   * Ouvre un dossier depuis un prospect enrôlé.
   *
   * L'identité du client est COPIÉE ici, et plus jamais réécrite. Un dossier
   * bancaire est une pièce à valeur historique : si un administrateur corrige
   * demain l'orthographe du prospect, le dossier doit continuer de refléter ce
   * qui a été transmis à la banque ce jour-là. C'est ce qui rend le rapport
   * opposable.
   */
  async create(user: AuthenticatedUser, input: CreateBankCaseDto): Promise<BankCaseDto> {
    const reference = normalizeReferenceDisplay(input.reference);
    const referenceKey = normalizeReferenceKey(input.reference);

    // Pré-contrôle : il donne un message exploitable et pointe le dossier
    // existant. Il ne suffit PAS, deux créations simultanées le franchissent
    // toutes les deux, d'où le rattrapage de P2002 plus bas. Le pré-contrôle
    // est pour l'ergonomie, la contrainte est pour la vérité.
    await this.assertReferenceFree(referenceKey);

    const prospect = await this.prisma.prospect.findFirst({
      where: { id: input.prospectId, deletedAt: null },
      select: {
        id: true,
        nom: true,
        prenom: true,
        phoneE164: true,
        banqueId: true,
        phase2Status: true,
        isDemo: true,
      },
    });
    if (!prospect) throw prospectNotFound();
    if (prospect.phase2Status !== Phase2Status.METHOD_OBTAINED) {
      throw prospectNotEnrolled(prospect.phase2Status, prospect.id);
    }

    const processingBankId = input.processingBankId ?? prospect.banqueId;
    const bank = await this.prisma.banque.findUnique({
      where: { id: processingBankId },
      select: { id: true },
    });
    if (!bank) throw bankNotFound(processingBankId);

    // `isActive: true` est indispensable, pas décoratif. Sans lui, une étape
    // initiale DÉSACTIVÉE continuait de recevoir tous les nouveaux dossiers :
    // l'administrateur qui la retire du workflow croit l'avoir sortie du
    // circuit, et les dossiers s'y accumulent à une étape qui n'apparaît plus
    // nulle part. Désactiver l'étape initiale sans en désigner une autre est
    // une configuration incomplète, et doit se dire comme telle.
    //
    // `orderBy` sur la position : rien n'interdit en base deux étapes
    // initiales actives. Sans ordre explicite, PostgreSQL est libre de rendre
    // l'une ou l'autre selon le plan retenu, et deux dossiers créés à la suite
    // pouvaient démarrer à des étapes différentes.
    const initial = await this.prisma.bankCaseStage.findFirst({
      where: { isInitial: true, isActive: true },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    if (!initial) {
      throw new ConflictException({
        code: BankCaseError.NO_INITIAL_STAGE,
        message: 'Le workflow bancaire n’a pas d’étape initiale ACTIVE : configuration incomplète.',
      });
    }

    const id = uuidv7();
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.bankCase.create({
          data: {
            id,
            reference,
            referenceKey,
            prospectId: prospect.id,
            customerName: `${prospect.prenom} ${prospect.nom}`.replace(/\s+/gu, ' ').trim(),
            customerPhoneE164: prospect.phoneE164,
            processingBankId,
            currentStageId: initial.id,
            createdById: user.id,
            // Le dossier hérite du PROSPECT sur lequel il porte, et non du mode
            // en vigueur à la seconde de l'ouverture. Un dossier ouvert sur une
            // fiche de démonstration atterrissait sinon dans le tableau de bord
            // réel et dans l'export transmis au siège, avec un montant inventé
            // qui s'ajoutait aux vrais encaissements.
            isDemo: prospect.isDemo,
          },
          include: BANK_CASE_INCLUDE,
        });
        // L'ouverture est elle-même une transition : sans elle, la timeline
        // commencerait au premier changement d'étape et personne ne saurait
        // qui a ouvert le dossier ni quand.
        await tx.bankCaseTransition.create({
          // L'historique suit son dossier : une transition réelle sur un
          // dossier de démonstration fausserait les délais de traitement.
          data: {
            caseId: row.id,
            toStageId: initial.id,
            performedById: user.id,
            isDemo: prospect.isDemo,
          },
        });
        return row;
      });
      return toBankCaseDto(created);
    } catch (error) {
      if (isUniqueViolation(error)) throw await this.referenceConflictError(referenceKey);
      throw error;
    }
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    input: UpdateBankCaseDto,
  ): Promise<BankCaseDto> {
    const existing = await this.loadCase(id);
    if (isTerminalStage(existing.currentStage)) throw terminalCase(existing.currentStage.label);

    // `Unchecked` et non `UpdateManyMutationInput` : la variante « vérifiée »
    // n'expose que les colonnes non relationnelles, or on écrit ici deux clés
    // étrangères (`updatedById`, `processingBankId`) que `updateMany` ne peut
    // pas atteindre par une relation imbriquée.
    const data: Prisma.BankCaseUncheckedUpdateManyInput = {
      updatedById: user.id,
      rev: { increment: 1 },
    };

    let referenceKey: string | undefined;
    if (input.reference !== undefined) {
      referenceKey = normalizeReferenceKey(input.reference);
      if (referenceKey !== existing.referenceKey) await this.assertReferenceFree(referenceKey);
      data.reference = normalizeReferenceDisplay(input.reference);
      data.referenceKey = referenceKey;
    }

    if (input.processingBankId !== undefined) {
      const bank = await this.prisma.banque.findUnique({
        where: { id: input.processingBankId },
        select: { id: true },
      });
      if (!bank) throw bankNotFound(input.processingBankId);
      data.processingBankId = input.processingBankId;
    }

    try {
      const updated = await this.prisma.bankCase.updateMany({
        where: { id, rev: input.expectedRev, deletedAt: null },
        data,
      });
      if (updated.count === 0) throw revConflict(toBankCaseDto(await this.loadCase(id)));
    } catch (error) {
      if (referenceKey !== undefined && isUniqueViolation(error)) {
        throw await this.referenceConflictError(referenceKey);
      }
      throw error;
    }

    return toBankCaseDto(await this.loadCase(id));
  }

  /** Avancée normale, réservée aux étapes atteignables depuis l'étape courante. */
  transition(
    user: AuthenticatedUser,
    id: string,
    input: CreateBankCaseTransitionDto,
  ): Promise<BankCaseDetailDto> {
    return this.applyTransition(user, id, input, undefined);
  }

  /**
   * Correction administrateur.
   *
   * Elle contourne l'atteignabilité et le verrou terminal, c'est sa raison
   * d'être, mais rien d'autre : les règles financières de l'étape visée
   * s'appliquent à l'identique, et la justification est obligatoire. Elle
   * s'inscrit dans le MÊME historique append-only, marquée par
   * `correctionReason` : une correction reste visible pour toujours, elle
   * n'efface pas ce qu'elle corrige.
   */
  correct(
    user: AuthenticatedUser,
    id: string,
    input: CreateBankCaseCorrectionDto,
  ): Promise<BankCaseDetailDto> {
    return this.applyTransition(user, id, input, input.reason.trim());
  }

  private async applyTransition(
    user: AuthenticatedUser,
    id: string,
    input: CreateBankCaseTransitionDto,
    correctionReason: string | undefined,
  ): Promise<BankCaseDetailDto> {
    const isCorrection = correctionReason !== undefined;
    const existing = await this.loadCase(id);

    if (!isCorrection && isTerminalStage(existing.currentStage)) {
      throw terminalCase(existing.currentStage.label);
    }

    const stages = await this.prisma.bankCaseStage.findMany();
    const target = stages.find((stage) => stage.id === input.targetStageId);
    if (!target) throw stageNotFound();

    if (isCorrection) {
      if (!target.isActive) {
        throw new ConflictException({
          code: BankCaseError.STAGE_INACTIVE,
          message: `L’étape « ${target.label} » est désactivée : aucun dossier ne peut y être placé.`,
          stageId: target.id,
        });
      }
    } else {
      assertReachable(stages, existing.currentStage, target);
    }

    const reason = await this.loadRejectionReason(input.rejectionReasonId);
    const effect = planTransitionEffect(target, input, reason?.code);
    const comment = input.comment?.trim();

    const outcome = await this.prisma.$transaction(async (tx) => {
      // Le garde de révision est DANS la mise à jour, pas avant : une lecture
      // suivie d'une écriture laisserait une fenêtre où deux agents passent
      // tous les deux le contrôle. Ici c'est PostgreSQL qui arbitre.
      const updated = await tx.bankCase.updateMany({
        where: { id, rev: input.expectedRev, deletedAt: null },
        data: {
          currentStageId: target.id,
          amountXof: effect.amountXof === null ? null : toDecimal(effect.amountXof),
          rejectionReasonId: effect.rejectionReasonId,
          rejectionDetail: effect.rejectionDetail,
          updatedById: user.id,
          rev: { increment: 1 },
        },
      });
      if (updated.count === 0) return REV_MISMATCH;

      // Même transaction, toujours : un dossier ne peut pas avancer sans
      // laisser de trace, ni laisser une trace sans avoir avancé.
      await tx.bankCaseTransition.create({
        data: {
          caseId: id,
          fromStageId: existing.currentStageId,
          toStageId: target.id,
          performedById: user.id,
          amountXof: effect.amountXof === null ? null : toDecimal(effect.amountXof),
          rejectionReasonId: effect.rejectionReasonId,
          rejectionDetail: effect.rejectionDetail,
          comment: comment === undefined || comment === '' ? null : comment,
          correctionReason: correctionReason ?? null,
          // L'historique suit SON DOSSIER, pas le mode en vigueur à la seconde
          // du changement d'étape : une transition non marquée sur un dossier
          // de démonstration ressortirait dans les délais de traitement réels.
          isDemo: existing.isDemo,
        },
      });
      return null;
    });

    if (outcome === REV_MISMATCH) {
      throw revConflict(toBankCaseDto(await this.loadCase(id)));
    }
    return this.get(id);
  }

  /**
   * Autocomplétion pour l'ouverture d'un dossier.
   *
   * Restreinte aux prospects enrôlés, les seuls sur lesquels un dossier peut
   * être ouvert, et à quatre champs : identité, téléphone, banque. Un agent
   * Banque & Finance n'a aucune raison de voir le commercial propriétaire, le
   * syndicat ou l'historique d'appels ; la projection est la mesure de
   * confidentialité, pas un filtre côté client.
   */
  async prospectSearch(query: ProspectSearchQueryDto): Promise<ProspectSearchListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_SEARCH_PAGE_SIZE;
    const term = query.search.trim();
    const like = `%${term.toLowerCase()}%`;

    // Le téléphone est cherché sous sa forme NORMALISÉE : « 77 123 45 67 »,
    // « +221771234567 », « 00221 77 123 45 67 » et « 221-77-123-45-67 »
    // désignent le même abonné et doivent tous répondre. Une saisie partielle
    // retombe sur les chiffres bruts.
    const digits = term.replace(/\D/gu, '');
    const normalized = tryNormalizePhone(term);
    const phone: Prisma.Sql =
      normalized !== undefined
        ? Prisma.sql`OR p."phoneE164" = ${normalized}`
        : digits.length >= 4
          ? Prisma.sql`OR p."phoneE164" LIKE ${`%${digits}`}`
          : Prisma.sql``;

    const where = Prisma.sql`
      p."deletedAt" IS NULL
      AND p."phase2Status" = 'METHOD_OBTAINED'::"Phase2Status"
      AND (
        (lower(p."nom") || ' ' || lower(p."prenom")) LIKE ${like}
        OR unaccent(lower(p."nom") || ' ' || lower(p."prenom")) LIKE unaccent(${like})
        OR unaccent(lower(p."prenom") || ' ' || lower(p."nom")) LIKE unaccent(${like})
        ${phone}
      )
    `;

    const [rows, totals] = await Promise.all([
      this.prisma.$queryRaw<
        {
          id: string;
          nom: string;
          prenom: string;
          phoneE164: string;
          banqueId: string;
          banqueName: string;
        }[]
      >`
        SELECT p."id", p."nom", p."prenom", p."phoneE164",
               b."id" AS "banqueId", b."name" AS "banqueName"
        FROM "prospects" p
        INNER JOIN "banques" b ON b."id" = p."banqueId"
        WHERE ${where}
        ORDER BY p."nom" ASC, p."prenom" ASC, p."id" ASC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total
        FROM "prospects" p
        INNER JOIN "banques" b ON b."id" = p."banqueId"
        WHERE ${where}
      `,
    ]);

    const total = totals[0]?.total ?? 0;
    return {
      items: rows.map((row) => ({
        id: row.id,
        nom: row.nom,
        prenom: row.prenom,
        fullName: `${row.prenom} ${row.nom}`.replace(/\s+/gu, ' ').trim(),
        phoneE164: row.phoneE164,
        banqueId: row.banqueId,
        banqueName: row.banqueName,
      })),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async listRejectionReasons(includeInactive: boolean): Promise<BankRejectionReasonListDto> {
    const rows = await this.prisma.bankRejectionReason.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    return { items: rows.map(toReasonDto) };
  }

  /** Chargement commun, avec les jointures d'affichage. 404 typé si absent. */
  private async loadCase(id: string): Promise<BankCaseRow> {
    const row = await this.prisma.bankCase.findFirst({
      where: { id, deletedAt: null },
      include: BANK_CASE_INCLUDE,
    });
    if (!row) throw caseNotFound();
    return row;
  }

  private async loadRejectionReason(
    id: string | undefined,
  ): Promise<BankRejectionReason | undefined> {
    if (id === undefined) return undefined;
    const reason = await this.prisma.bankRejectionReason.findUnique({ where: { id } });
    if (!reason) {
      throw new BadRequestException({
        code: BankCaseError.REJECTION_REASON_NOT_FOUND,
        message: 'Motif de rejet inconnu.',
        rejectionReasonId: id,
      });
    }
    if (!reason.isActive) {
      throw new BadRequestException({
        code: BankCaseError.REJECTION_REASON_NOT_FOUND,
        message: `Le motif « ${reason.label} » est désactivé.`,
        rejectionReasonId: id,
      });
    }
    return reason;
  }

  /**
   * LECTURE GLOBALE délibérée : l'index unique partiel
   * `bank_cases_reference_key_active` est global, il ne connaît pas le mode
   * démonstration. Filtré, ce pré-contrôle déclarerait libre une référence que
   * la base refuse ensuite, et l'agent recevrait un 409 générique au lieu du
   * message qui pointe le dossier existant.
   */
  private async assertReferenceFree(referenceKey: string): Promise<void> {
    const clash = await this.prisma.bankCase.findFirst({
      where: { referenceKey, deletedAt: null },
      select: {
        id: true,
        reference: true,
        referenceKey: true,
        customerName: true,
        createdAt: true,
      },
    });
    if (clash) throw referenceConflict(clash);
  }

  /**
   * Rattrapage de la course sur `bank_cases_reference_key_active`.
   *
   * Le pré-contrôle et la contrainte ne font pas double emploi : entre la
   * lecture et l'insertion, une autre requête peut prendre la référence. Sans
   * ce rattrapage, le second agent reçoit un 500 illisible là où le premier
   * recevait un message clair, pour exactement la même erreur.
   *
   * LECTURE GLOBALE délibérée, pour la même raison qu'`assertReferenceFree` :
   * on relit la ligne que l'index GLOBAL vient de faire gagner.
   */
  private async referenceConflictError(referenceKey: string): Promise<ConflictException> {
    const existing = await this.prisma.bankCase.findFirst({
      where: { referenceKey, deletedAt: null },
      select: {
        id: true,
        reference: true,
        referenceKey: true,
        customerName: true,
        createdAt: true,
      },
    });
    if (existing) return referenceConflict(existing);
    return new ConflictException({
      code: BankCaseError.REFERENCE_CONFLICT,
      message: 'Cette référence bancaire est déjà utilisée.',
    });
  }
}

/** Violation d'unicité PostgreSQL, telle que Prisma la remonte. */
export const isUniqueViolation = (error: unknown): boolean =>
  isPrismaKnownError(error) && error.code === 'P2002';
