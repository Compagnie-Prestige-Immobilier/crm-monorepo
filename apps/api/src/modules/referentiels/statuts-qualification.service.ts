import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrioriteTraitement, RepCallOutcome, StatutQualificationEffect } from '@crm/database';
import type { StatutQualification } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { sansAccents } from '../../common/texte.js';
import type {
  CreateStatutQualificationDto,
  SetStatutQualificationActiveDto,
  StatutQualificationDto,
  StatutQualificationListDto,
  UpdateStatutQualificationDto,
} from './dto.js';

const StatutQualificationError = {
  NOT_FOUND: 'STATUT_QUALIFICATION_NOT_FOUND',
  CODE_CONFLICT: 'STATUT_QUALIFICATION_CODE_CONFLICT',
  LABEL_CONFLICT: 'STATUT_QUALIFICATION_LABEL_CONFLICT',
  LABEL_UNUSABLE: 'STATUT_QUALIFICATION_LABEL_UNUSABLE',
  SYSTEM_IMMUTABLE: 'STATUT_QUALIFICATION_SYSTEM_IMMUTABLE',
  CALLBACK_NOT_ALLOWED: 'STATUT_QUALIFICATION_CALLBACK_NOT_ALLOWED',
  LAST_OF_BRANCH: 'STATUT_QUALIFICATION_LAST_OF_BRANCH',
} as const;

/** Version de charge utile qu'un client doit atteindre pour émettre un statut créé ici. */
const NEW_STATUT_PAYLOAD_VERSION = 6;

/**
 * L'issue enregistrée découle de l'effet, jamais de ce que le client envoie.
 * Écrite une seule fois : quand la règle vivait dans les deux clients, ils
 * divergeaient au premier libellé ajouté.
 */
const OUTCOME_BY_EFFECT: Record<StatutQualificationEffect, RepCallOutcome> = {
  [StatutQualificationEffect.REACHED]: RepCallOutcome.REACHED,
  [StatutQualificationEffect.REFUSED]: RepCallOutcome.REFUSED,
  [StatutQualificationEffect.SCHEDULE_CALLBACK]: RepCallOutcome.CALLBACK,
  [StatutQualificationEffect.UNREACHABLE]: RepCallOutcome.UNREACHABLE,
  [StatutQualificationEffect.WRONG_NUMBER]: RepCallOutcome.WRONG_NUMBER,
};

export function outcomeOf(effect: StatutQualificationEffect): RepCallOutcome {
  return OUTCOME_BY_EFFECT[effect];
}

/**
 * La famille du statut, déduite de l'effet et non stockée : une colonne
 * « joignable » divergerait à la première correction. Un faux numéro est JOINT,
 * la fiche est traitée ; un rappel convenu l'est aussi, et il est le seul joint
 * qui repasse. Les deux familles PARTITIONNENT les effets : un statut se
 * propose sous une seule branche du script.
 */
const JOINT: readonly StatutQualificationEffect[] = [
  StatutQualificationEffect.REACHED,
  StatutQualificationEffect.REFUSED,
  StatutQualificationEffect.SCHEDULE_CALLBACK,
  StatutQualificationEffect.WRONG_NUMBER,
];

const NON_JOINT: readonly StatutQualificationEffect[] = [StatutQualificationEffect.UNREACHABLE];

const brancheDe = (effect: StatutQualificationEffect): readonly StatutQualificationEffect[] =>
  JOINT.includes(effect) ? JOINT : NON_JOINT;

/**
 * Le code se lit dans le libellé : l'administrateur n'en saisit plus. Il ne se
 * dérive qu'A LA CREATION, jamais en renommant, car l'historique le référence.
 */
const codeDepuisLibelle = (label: string): string =>
  sansAccents(label).toUpperCase().replace(/\s+/gu, '_');

const CODE_UTILISABLE = /^[A-Za-z][A-Za-z0-9_]*$/u;

const toDto = (row: StatutQualification): StatutQualificationDto => ({
  id: row.id,
  code: row.code,
  label: row.label,
  effect: row.effect,
  requiresCallback: row.requiresCallback,
  requiresComment: row.requiresComment,
  retryAfterMinutes: row.retryAfterMinutes,
  priorite: row.priorite,
  relationStatus: row.relationStatus,
  isActive: row.isActive,
  isSystem: row.isSystem,
  minPayloadVersion: row.minPayloadVersion,
  updatedAt: row.updatedAt.toISOString(),
});

const ORDER = [{ sortOrder: 'asc' as const }, { label: 'asc' as const }];

const withDefault = <T>(value: T | undefined, fallback: T): T => value ?? fallback;

const optionalField = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> =>
  value === undefined ? {} : ({ [key]: value } as Record<K, V>);

@Injectable()
export class StatutsQualificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vocabulaire d'un client de saisie. Le filtre de version est la seule
   * barrière qui empêche un téléphone de proposer un code qu'il ne sait pas
   * émettre : sa remontée finirait en échec définitif, hors ligne.
   */
  async listForField(payloadVersion: number): Promise<StatutQualificationListDto> {
    const rows = await this.prisma.statutQualification.findMany({
      where: { isActive: true, minPayloadVersion: { lte: payloadVersion } },
      orderBy: ORDER,
    });
    return { items: rows.map(toDto) };
  }

  async listAll(): Promise<StatutQualificationListDto> {
    const rows = await this.prisma.statutQualification.findMany({ orderBy: ORDER });
    return { items: rows.map(toDto) };
  }

  async create(input: CreateStatutQualificationDto): Promise<StatutQualificationDto> {
    const label = input.label.trim();
    const code = codeDepuisLibelle(label);

    if (!CODE_UTILISABLE.test(code)) {
      throw new BadRequestException({
        code: StatutQualificationError.LABEL_UNUSABLE,
        message: `« ${label} » ne donne aucun code utilisable : commencez par une lettre et n’employez que des lettres, des chiffres et des espaces.`,
      });
    }

    await this.assertLabelAvailable(label);

    const clash = await this.prisma.statutQualification.findUnique({ where: { code } });
    if (clash) {
      throw new ConflictException({
        code: StatutQualificationError.CODE_CONFLICT,
        message: `« ${label} » donne le même code que « ${clash.label} » : distinguez-les autrement que par les accents ou la casse.`,
        existingId: clash.id,
      });
    }

    const requiresCallback = withDefault(input.requiresCallback, false);
    this.assertCallbackAllowed(input.effect, requiresCallback);

    const created = await this.prisma.statutQualification.create({
      data: {
        code,
        label,
        effect: input.effect,
        requiresCallback,
        requiresComment: withDefault(input.requiresComment, false),
        retryAfterMinutes: withDefault(input.retryAfterMinutes, null),
        priorite: withDefault(input.priorite, PrioriteTraitement.NORMALE),
        relationStatus: withDefault(input.relationStatus, null),
        sortOrder: await this.rangSuivant(input.effect),
        isActive: true,
        isSystem: false,
        minPayloadVersion: NEW_STATUT_PAYLOAD_VERSION,
      },
    });
    return toDto(created);
  }

  async update(id: string, input: UpdateStatutQualificationDto): Promise<StatutQualificationDto> {
    const existing = await this.statut(id);

    this.assertSystemRuleUnchanged(existing, input);

    if (input.requiresCallback !== undefined) {
      this.assertCallbackAllowed(existing.effect, input.requiresCallback);
    }

    if (input.label !== undefined) {
      await this.assertLabelAvailable(input.label.trim(), id);
    }

    const updated = await this.prisma.statutQualification.update({
      where: { id },
      data: {
        ...optionalField('label', input.label?.trim()),
        ...optionalField('requiresCallback', input.requiresCallback),
        ...optionalField('requiresComment', input.requiresComment),
        ...optionalField('priorite', input.priorite),
        ...optionalField('relationStatus', input.relationStatus),
        ...optionalField('retryAfterMinutes', input.retryAfterMinutes),
      },
    });
    return toDto(updated);
  }

  /**
   * Désactiver est permis, y compris sur un statut système : c'est le geste
   * que l'administration réclame. Ce qui est refusé, c'est de vider une
   * branche du script : un écran sans aucune issue proposable ne se rattrape
   * pas depuis le terrain.
   */
  async setActive(
    id: string,
    input: SetStatutQualificationActiveDto,
  ): Promise<StatutQualificationDto> {
    const existing = await this.statut(id);

    if (!input.isActive && existing.isActive) {
      await this.assertBranchStaysReachable(existing);
    }

    const updated = await this.prisma.statutQualification.update({
      where: { id },
      data: { isActive: input.isActive },
    });
    return toDto(updated);
  }

  /**
   * L'ordre d'affichage ne se saisit pas : il ne dit rien du métier, et le
   * demander à l'administrateur lui ferait trancher une question qu'il n'a pas.
   * Un statut nouveau se pose à la fin de SA branche, jamais au milieu de
   * l'autre.
   */
  private async rangSuivant(effect: StatutQualificationEffect): Promise<number> {
    const dernier = await this.prisma.statutQualification.findFirst({
      where: { effect: { in: [...brancheDe(effect)] } },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (dernier?.sortOrder ?? 0) + 10;
  }

  private async statut(id: string): Promise<StatutQualification> {
    const found = await this.prisma.statutQualification.findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundException({
        code: StatutQualificationError.NOT_FOUND,
        message: 'Statut de qualification introuvable.',
      });
    }
    return found;
  }

  private assertCallbackAllowed(
    effect: StatutQualificationEffect,
    requiresCallback: boolean,
  ): void {
    if (!requiresCallback || effect === StatutQualificationEffect.SCHEDULE_CALLBACK) return;
    throw new ConflictException({
      code: StatutQualificationError.CALLBACK_NOT_ALLOWED,
      message: `Seul l’effet SCHEDULE_CALLBACK planifie un rappel : « ${effect} » ne peut pas en exiger la date.`,
      effect,
    });
  }

  private async assertLabelAvailable(label: string, excludeId?: string): Promise<void> {
    const sameLabel = await this.prisma.statutQualification.findUnique({ where: { label } });
    if (!sameLabel || sameLabel.id === excludeId) return;
    throw new ConflictException({
      code: StatutQualificationError.LABEL_CONFLICT,
      message: `Le libellé « ${label} » est déjà porté par un autre statut.`,
      existingId: sameLabel.id,
    });
  }

  // Le libellé, la priorité et la relation posée se corrigent toujours,
  // système compris : ce sont des arbitrages du métier. La RÈGLE, elle, ne se
  // reconfigure pas : le script s'appuie dessus, et les clients déployés
  // l'ont compilée.
  private assertSystemRuleUnchanged(
    existing: StatutQualification,
    input: UpdateStatutQualificationDto,
  ): void {
    const regleTouchee =
      input.requiresCallback !== undefined || input.requiresComment !== undefined;
    if (!existing.isSystem || !regleTouchee) return;
    throw new ConflictException({
      code: StatutQualificationError.SYSTEM_IMMUTABLE,
      message: `« ${existing.label} » est un statut système : sa règle est celle du script et ne se reconfigure pas ici.`,
      statutId: existing.id,
    });
  }

  private async assertBranchStaysReachable(existing: StatutQualification): Promise<void> {
    const restants = await this.prisma.statutQualification.count({
      where: {
        isActive: true,
        effect: { in: [...brancheDe(existing.effect)] },
        id: { not: existing.id },
      },
    });
    if (restants > 0) return;
    throw new ConflictException({
      code: StatutQualificationError.LAST_OF_BRANCH,
      message: `« ${existing.label} » est le dernier statut actif de sa branche : la retirer laisserait le script sans issue possible.`,
      statutId: existing.id,
    });
  }
}
