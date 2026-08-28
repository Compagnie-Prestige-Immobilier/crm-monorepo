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
  bankRequired,
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

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SEARCH_PAGE_SIZE = 20;

/**
 * Le motif de recherche est désaccentué ICI, et non en SQL.
 *
 * `LIKE ANY (SELECT immutable_unaccent(m) FROM unnest(...))` marche, mais le
 * planificateur y perd l'index et retombe en balayage séquentiel : vérifié à
 * l'EXPLAIN. Le tableau doit rester une CONSTANTE pour que le
 * `Bitmap Index Scan` tienne.
 *
 * L'accord avec le dictionnaire de PostgreSQL est vérifié par un test
 * d'intégration, sur les accents que portent réellement les noms d'ici.
 */
export const sansAccents = (valeur: string): string =>
  valeur.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Sentinelle interne : la transaction n'a rien mis à jour, la révision a bougé. */
const REV_MISMATCH = Symbol('rev-mismatch');

@Injectable()
export class BankCasesService {
  constructor(private readonly prisma: PrismaService) {}

  // Les identifiants viennent de la MÊME requête SQL que les agrégats, puis sont
  // hydratés : un aller-retour de plus, mais une seule définition du filtre.
  async list(query: BankCaseQueryDto): Promise<BankCaseListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = bankCaseConditions(query);
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
    // LECTURE GLOBALE : le cloisonnement s'est joué sur le dossier, déjà
    // résolu ci-dessus. Le rejouer ici rendrait une fiche sans son historique.
    const history = await this.prisma.bankCaseTransition.findMany({
      where: { caseId: id },
      include: BANK_TRANSITION_INCLUDE,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return { bankCase: toBankCaseDto(row), history: history.map(toTransitionDto) };
  }

  // L'identité du client est COPIÉE ici et plus jamais réécrite : le dossier doit
  // refléter ce qui a été transmis à la banque ce jour-là, c'est ce qui le rend opposable.
  async create(user: AuthenticatedUser, input: CreateBankCaseDto): Promise<BankCaseDto> {
    const reference = normalizeReferenceDisplay(input.reference);
    const referenceKey = normalizeReferenceKey(input.reference);

    // Pré-contrôle pour l'ergonomie, contrainte pour la vérité : deux créations
    // simultanées le franchissent toutes les deux, d'où le rattrapage P2002 plus bas.
    await this.assertReferenceFree(referenceKey);

    const prospect = await this.prisma.prospect.findFirst({
      where: {
        id: input.prospectId,
        deletedAt: null,
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        phoneE164: true,
        banqueId: true,
        phase2Status: true,
      },
    });
    if (!prospect) throw prospectNotFound();
    if (prospect.phase2Status !== Phase2Status.METHOD_OBTAINED) {
      throw prospectNotEnrolled(prospect.phase2Status, prospect.id);
    }

    // La banque du prospect est desormais facultative : un dossier ne peut pas
    // s'ouvrir sans en designer une, explicitement ou par heritage.
    const processingBankId = input.processingBankId ?? prospect.banqueId;
    if (processingBankId === null) throw bankRequired();
    const bank = await this.prisma.banque.findUnique({
      where: { id: processingBankId },
      select: { id: true },
    });
    if (!bank) throw bankNotFound(processingBankId);

    // `isActive` : une étape initiale désactivée ne doit plus rien recevoir.
    // `orderBy` : rien n'interdit deux étapes initiales actives, il faut les départager.
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
          },
          include: BANK_CASE_INCLUDE,
        });
        // L'ouverture est elle-même une transition, sans quoi la timeline ne dirait
        // pas qui a ouvert le dossier ni quand.
        await tx.bankCaseTransition.create({
          data: {
            caseId: row.id,
            toStageId: initial.id,
            performedById: user.id,
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

    // `Unchecked` : la variante vérifiée n'expose pas les clés étrangères
    // (`updatedById`, `processingBankId`) qu'on écrit ici.
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

  // Contourne l'atteignabilité et le verrou terminal, RIEN d'autre : les règles
  // financières s'appliquent à l'identique et l'historique reste append-only.
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
      // Le garde de révision est DANS la mise à jour : lire puis écrire laisserait
      // une fenêtre où deux agents passent tous les deux le contrôle.
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

      // Même transaction : un dossier n'avance pas sans trace, ni ne laisse de
      // trace sans avoir avancé.
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
          // L'historique suit SON DOSSIER, pas le mode en vigueur à la transition.
        },
      });
      return null;
    });

    if (outcome === REV_MISMATCH) {
      throw revConflict(toBankCaseDto(await this.loadCase(id)));
    }
    return this.get(id);
  }

  // Restreinte aux prospects enrôlés. La PROJECTION est la mesure de
  // confidentialité, pas un filtre côté client : rien d'autre n'est lu.
  async prospectSearch(query: ProspectSearchQueryDto): Promise<ProspectSearchListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_SEARCH_PAGE_SIZE;
    const term = query.search.trim();

    // « Fall Moussa » et « Moussa Fall » désignent la même personne. La
    // permutation se fait sur le TERME : inverser les COLONNES demanderait une
    // seconde expression, que l'index ne couvre pas, et ramènerait le balayage
    // séquentiel que cet index existe pour éviter.
    const jetons = sansAccents(term.toLowerCase()).split(/\s+/u).filter(Boolean);
    const [premier, second] = jetons;
    const formesRecherchees =
      jetons.length === 2 && premier !== undefined && second !== undefined
        ? [`%${premier} ${second}%`, `%${second} ${premier}%`]
        : [`%${sansAccents(term.toLowerCase())}%`];

    // Téléphone cherché sous sa forme NORMALISÉE : les quatre écritures d'un même
    // abonné doivent répondre. Une saisie partielle retombe sur les chiffres bruts.
    const digits = term.replace(/\D/gu, '');
    const normalized = tryNormalizePhone(term);
    let phone = Prisma.sql``;
    if (normalized !== undefined) {
      phone = Prisma.sql`OR p."phoneE164" = ${normalized}`;
    } else if (digits.length >= 4) {
      phone = Prisma.sql`OR p."phoneE164" LIKE ${`%${digits}`}`;
    }

    const where = Prisma.sql`
      p."deletedAt" IS NULL
      AND ${Prisma.sql`TRUE`}
      AND p."phase2Status" = 'METHOD_OBTAINED'::"Phase2Status"
      AND (
        -- UNE seule forme, celle que prospects_nom_prenom_unaccent_trgm indexe
        -- au caractère près. Les trois branches d'avant se subsumaient : sans
        -- accent, unaccent étant une substitution caractère à caractère, la
        -- forme accentuée trouvait tout ce que trouvait la forme brute. Aucun
        -- plan ne pouvait donc emprunter l'index, payé à chaque INSERT.
        --
        -- L'ordre inversé « prénom nom » se traite en permutant les jetons du
        -- TERME, pas les colonnes : une seconde expression rouvrirait le même
        -- balayage séquentiel.
        immutable_unaccent(lower(p."nom") || ' ' || lower(p."prenom")) LIKE ANY (${formesRecherchees}::text[])
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
