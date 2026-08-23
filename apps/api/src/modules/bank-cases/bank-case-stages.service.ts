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

const MAX_OPEN_POSITION = 99;

/** Clé arbitraire mais stable : seule la file des positions d'étapes s'y sérialise. */
const STAGE_POSITION_LOCK = 4_271_001;

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

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // `position` ne porte aucune unicité en base et aucune migration n'est
        // possible : sans ce verrou, deux créations simultanées lisent le même
        // rang en READ COMMITTED et l'écrivent toutes les deux.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${STAGE_POSITION_LOCK})`;

        const open = await tx.bankCaseStage.findMany({
          where: { type: BankStageType.OPEN },
          orderBy: { position: 'asc' },
          select: { id: true, position: true },
        });
        const requested = input.position ?? (open.at(-1)?.position ?? 0) + 1;
        const position = Math.min(Math.max(requested, 1), MAX_OPEN_POSITION);

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
