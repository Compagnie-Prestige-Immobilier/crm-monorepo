import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { BankStageType } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { BankCaseError, stageNotFound } from './errors.js';
import { isUniqueViolation } from './bank-cases.service.js';
import { toStageDto } from './mappers.js';
import type {
  BankCaseStageDto,
  BankCaseStageListDto,
  CreateBankCaseStageDto,
  ReorderBankCaseStagesDto,
  SetBankCaseStageActiveDto,
  UpdateBankCaseStageDto,
} from './dto.js';

/** Réservées aux étapes système « Encaissé » (100) et « Rejeté » (101). */
const MAX_OPEN_POSITION = 99;

/**
 * Configuration du workflow, réservée à l'ADMIN.
 *
 * Deux invariants gouvernent ce service :
 *
 *  - une étape SYSTÈME est intouchable dans sa nature. Les trois étapes
 *    système portent des règles financières — point d'entrée, encaissement,
 *    rejet — dont dépend tout le reste du module. Les désactiver reviendrait à
 *    rendre le workflow inexploitable sans le moindre message d'erreur ;
 *  - réordonner n'affecte QUE les transitions futures. Les positions ne sont
 *    lues qu'au moment de calculer l'étape suivante ; l'historique référence
 *    des étapes par identifiant et reste lisible des années après un
 *    remaniement du flux.
 */
@Injectable()
export class BankCaseStagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeInactive: boolean): Promise<BankCaseStageListDto> {
    const rows = await this.prisma.bankCaseStage.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ position: 'asc' }, { code: 'asc' }],
    });
    return { items: rows.map(toStageDto) };
  }

  /**
   * Crée une étape OUVERTE intermédiaire. Le type n'est pas un paramètre :
   * une seconde étape d'encaissement ou de rejet violerait les index partiels
   * `bank_case_stages_single_cashed` / `_single_rejected`, et surtout rendrait
   * la règle financière ambiguë.
   */
  async create(input: CreateBankCaseStageDto): Promise<BankCaseStageDto> {
    const code = input.code.trim().toUpperCase();
    const clash = await this.prisma.bankCaseStage.findUnique({ where: { code } });
    if (clash) {
      throw new ConflictException({
        code: BankCaseError.STAGE_CODE_CONFLICT,
        message: `Le code « ${code} » est déjà utilisé par l’étape « ${clash.label} ».`,
        existingId: clash.id,
      });
    }

    const open = await this.prisma.bankCaseStage.findMany({
      where: { type: BankStageType.OPEN },
      orderBy: { position: 'asc' },
      select: { id: true, position: true },
    });
    const requested = input.position ?? (open.at(-1)?.position ?? 0) + 1;
    const position = Math.min(Math.max(requested, 1), MAX_OPEN_POSITION);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Insertion au milieu du flux : on décale les suivantes plutôt que de
        // laisser deux étapes partager une position, ce qui rendrait « l'étape
        // suivante » non déterministe.
        const shifted = open.filter((stage) => stage.position >= position);
        for (const stage of shifted) {
          await tx.bankCaseStage.update({
            where: { id: stage.id },
            data: { position: Math.min(stage.position + 1, MAX_OPEN_POSITION) },
          });
        }
        return tx.bankCaseStage.create({
          data: {
            code,
            label: input.label.trim(),
            color: input.color.trim(),
            position,
            type: BankStageType.OPEN,
            isActive: true,
            isInitial: false,
            isSystem: false,
          },
        });
      });
      return toStageDto(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: BankCaseError.STAGE_CODE_CONFLICT,
          message: `Le code « ${code} » est déjà utilisé.`,
        });
      }
      throw error;
    }
  }

  /**
   * Renommage et recoloriage seulement. Ni le code, ni le type, ni le drapeau
   * initial : une étape déjà inscrite dans l'historique d'un dossier clos ne
   * doit pas changer de nature rétroactivement.
   */
  async update(id: string, input: UpdateBankCaseStageDto): Promise<BankCaseStageDto> {
    const existing = await this.prisma.bankCaseStage.findUnique({ where: { id } });
    if (!existing) throw stageNotFound();

    const updated = await this.prisma.bankCaseStage.update({
      where: { id },
      data: {
        ...(input.label === undefined ? {} : { label: input.label.trim() }),
        ...(input.color === undefined ? {} : { color: input.color.trim() }),
      },
    });
    return toStageDto(updated);
  }

  /**
   * Réordonne les étapes OUVERTES.
   *
   * La liste doit être exhaustive — toutes les étapes ouvertes, actives ou
   * non. Un réordonnancement partiel laisserait des positions en doublon ou en
   * trou, et « l'étape suivante » deviendrait indéterminée pour les dossiers
   * qui stationnent dans la partie non transmise.
   */
  async reorder(input: ReorderBankCaseStagesDto): Promise<BankCaseStageListDto> {
    const open = await this.prisma.bankCaseStage.findMany({
      where: { type: BankStageType.OPEN },
      orderBy: { position: 'asc' },
    });

    const known = new Set(open.map((stage) => stage.id));
    const received = new Set(input.stageIds);
    const unknown = input.stageIds.filter((id) => !known.has(id));
    const missing = open.filter((stage) => !received.has(stage.id)).map((stage) => stage.id);

    if (unknown.length > 0 || missing.length > 0) {
      throw new BadRequestException({
        code: BankCaseError.STAGE_REORDER_INCOMPLETE,
        message:
          'La liste doit contenir exactement toutes les étapes ouvertes, chacune une seule fois.',
        unknown,
        missing,
      });
    }

    // L'étape initiale reste en tête : un dossier naît sur elle, et la placer
    // au milieu du flux rendrait inaccessibles les étapes qui la précèdent.
    const initial = open.find((stage) => stage.isInitial);
    if (initial && input.stageIds[0] !== initial.id) {
      throw new BadRequestException({
        code: BankCaseError.STAGE_INITIAL_MUST_BE_FIRST,
        message: `L’étape initiale « ${initial.label} » doit rester en première position.`,
        initialStageId: initial.id,
      });
    }

    await this.prisma.$transaction(
      input.stageIds.map((id, index) =>
        this.prisma.bankCaseStage.update({ where: { id }, data: { position: index + 1 } }),
      ),
    );
    return this.list(true);
  }

  /**
   * Active ou désactive une étape.
   *
   * Deux refus, tous deux typés :
   *  - une étape système n'est jamais désactivable, sinon le workflow perd son
   *    point d'entrée ou l'une de ses issues financières ;
   *  - une étape qui porte encore des dossiers ne l'est pas non plus. Les
   *    dossiers concernés deviendraient invisibles du flux, sans que personne
   *    ne soit averti qu'ils existent toujours.
   */
  async setActive(id: string, input: SetBankCaseStageActiveDto): Promise<BankCaseStageDto> {
    const stage = await this.prisma.bankCaseStage.findUnique({ where: { id } });
    if (!stage) throw stageNotFound();

    if (stage.isSystem) {
      throw new ConflictException({
        code: BankCaseError.STAGE_SYSTEM_IMMUTABLE,
        message: `« ${stage.label} » est une étape système : son activation ne se configure pas.`,
        stageId: stage.id,
      });
    }

    if (!input.isActive) {
      const held = await this.prisma.bankCase.count({
        where: { currentStageId: id, deletedAt: null },
      });
      if (held > 0) {
        throw new ConflictException({
          code: BankCaseError.STAGE_HAS_OPEN_CASES,
          message: `${String(held)} dossier(s) stationnent sur « ${stage.label} ». Faites-les avancer avant de désactiver l’étape.`,
          stageId: stage.id,
          caseCount: held,
        });
      }
    }

    const updated = await this.prisma.bankCaseStage.update({
      where: { id },
      data: { isActive: input.isActive },
    });
    return toStageDto(updated);
  }
}
