import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizePhone } from '../../common/phone.js';
import { AuditAction, audit } from '../../common/audit.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { hashPassword } from '../auth/password.js';
import type {
  CreateUserDto,
  ResetPasswordDto,
  SetActiveDto,
  UpdateUserDto,
  UserDto,
  UserListDto,
  UserListQueryDto,
} from './dto.js';

type UserRow = Prisma.UserGetPayload<{
  include: { departement: { select: { name: true } }; _count: { select: { prospects: true } } };
}>;

type UserChanges = UpdateUserDto & Partial<SetActiveDto>;

const INCLUDE = {
  departement: { select: { name: true } },
  _count: { select: { prospects: true } },
} satisfies Prisma.UserInclude;

function toDto(user: UserRow): UserDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    departementId: user.departementId,
    departementName: user.departement?.name ?? null,
    phoneE164: user.phoneE164,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    prospectCount: user._count.prospects,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: UserListQueryDto): Promise<UserListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };
    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toDto),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async get(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    if (!user)
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Compte introuvable.' });
    return toDto(user);
  }

  async create(input: CreateUserDto, actor: Pick<AuthenticatedUser, 'id'>): Promise<UserDto> {
    await this.assertIdentifiersFree(input.email, input.username);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email.trim().toLowerCase(),
          username: input.username.trim().toLowerCase(),
          fullName: input.fullName.trim(),
          passwordHash: await hashPassword(input.password),
          role: input.role ?? Role.COMMERCIAL,
          ...(input.departementId ? { departementId: input.departementId } : {}),
          ...(input.phone ? { phoneE164: normalizePhone(input.phone) } : {}),
        },
        include: INCLUDE,
      });
      await audit(tx, actor, {
        action: AuditAction.USER_CREATE,
        entity: 'user',
        entityId: created.id,
        after: { email: created.email, username: created.username, role: created.role },
      });
      return created;
    });
    return toDto(user);
  }

  /**
   * Les gardes qu'un `PATCH` contournait.
   *
   * `remove` et `setActive` bloquaient déjà le cas « soi-même » ; `update` avait
   * été oublié. Un administrateur pouvait donc se rétrograder lui-même, et s'il
   * était le seul, la plateforme se retrouvait SANS aucun administrateur :
   * plus de création de compte, plus de purge, plus de publication d'APK,
   * récupération par SQL direct uniquement.
   */
  private async assertAdminSurvives(
    tx: Prisma.TransactionClient,
    existing: { id: string; role: Role },
    actor: Pick<AuthenticatedUser, 'id'>,
    nextRole: Role | undefined,
    nextActive: boolean | undefined,
  ): Promise<void> {
    const perdSonAdmin =
      existing.role === Role.ADMIN &&
      ((nextRole && nextRole !== Role.ADMIN) || nextActive === false);
    if (!perdSonAdmin) return;

    if (existing.id === actor.id && nextRole && nextRole !== Role.ADMIN) {
      throw new BadRequestException({
        code: 'CANNOT_DEMOTE_SELF',
        message: 'Un administrateur ne peut pas retirer son propre rôle.',
      });
    }

    const restants = await tx.user.count({
      where: { role: Role.ADMIN, isActive: true, deletedAt: null, id: { not: existing.id } },
    });
    if (restants === 0) {
      throw new BadRequestException({
        code: 'LAST_ADMIN',
        message: 'C’est le dernier administrateur actif : nommez-en un autre d’abord.',
      });
    }
  }

  async update(
    id: string,
    input: UserChanges,
    actor: Pick<AuthenticatedUser, 'id'>,
  ): Promise<UserDto> {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Compte introuvable.' });
    }

    const email = input.email?.trim().toLowerCase();
    const username = input.username?.trim().toLowerCase();
    await this.assertIdentifiersFree(
      email && email !== existing.email ? email : undefined,
      username && username !== existing.username ? username : undefined,
    );

    const roleChanged = input.role !== undefined && input.role !== existing.role;

    const user = await this.prisma.$transaction(async (tx) => {
      await this.assertAdminSurvives(tx, existing, actor, input.role, input.isActive);

      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(email ? { email } : {}),
          ...(username ? { username } : {}),
          ...(input.fullName ? { fullName: input.fullName.trim() } : {}),
          ...(input.role ? { role: input.role } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          // La chaine VIDE efface, l'absence ne change rien. Sans cette
          // distinction, « Aucun » cote panneau ne pouvait que taire le champ, et
          // un departement pose par erreur ne se retirait jamais.
          ...(input.departementId !== undefined
            ? { departementId: input.departementId === '' ? null : input.departementId }
            : {}),
          ...(input.phone !== undefined
            ? { phoneE164: input.phone ? normalizePhone(input.phone) : null }
            : {}),
        },
        include: INCLUDE,
      });

      await audit(tx, actor, {
        action: roleChanged ? AuditAction.USER_ROLE_CHANGE : AuditAction.USER_UPDATE,
        entity: 'user',
        entityId: id,
        before: { role: existing.role, isActive: existing.isActive, email: existing.email },
        after: { role: updated.role, isActive: updated.isActive, email: updated.email },
      });

      return updated;
    });

    // Désactiver un compte doit couper ses sessions ouvertes : sans cela le
    // porteur d'un access token continue de travailler jusqu'à son expiration
    // et son refresh token reste valable des semaines.
    //
    // CHANGER LE RÔLE aussi, et pour la même raison poussée d'un cran. Le jeton
    // d'accès PORTE le rôle : sans révocation, l'ancien administrateur garde un
    // refresh token valable des semaines, avec lequel il obtient à volonté de
    // nouveaux jetons. `FreshSessionGuard` relit désormais le rôle en base à
    // chaque requête qui en exige un, ce qui ferme la fenêtre de quinze minutes
    // du jeton déjà émis ; la révocation ci-dessous ferme la porte de derrière,
    // celle du renouvellement. Les deux sont nécessaires, et aucune ne remplace
    // l'autre : la première corrige l'AUTORITÉ, la seconde met fin à la SESSION.
    if (input.isActive === false || roleChanged) await this.revokeSessions(id);

    return toDto(user);
  }

  async setActive(
    id: string,
    input: SetActiveDto,
    actor: Pick<AuthenticatedUser, 'id'>,
  ): Promise<UserDto> {
    if (id === actor.id && !input.isActive) {
      throw new BadRequestException({
        code: 'CANNOT_DEACTIVATE_SELF',
        message: 'Un administrateur ne peut pas désactiver son propre compte.',
      });
    }
    if (!input.isActive) await this.handOverPortfolio(id, input.handoverToId, actor);
    return this.update(id, { isActive: input.isActive }, actor);
  }

  /**
   * Un compte qui part laisse un portefeuille, et ce portefeuille GÈLE.
   *
   * `createdById` reste sur lui : plus aucun commercial actif ne peut lire ni
   * corriger ces fiches, et ses tâches de campagne encore ouvertes les bloquent
   * hors de tout tirage futur — l'index d'unicité de tâche active interdit même
   * qu'une campagne ultérieure les reprenne. La reprise est donc exigée, pas
   * proposée.
   */
  private async handOverPortfolio(
    id: string,
    handoverToId: string | undefined,
    actor: Pick<AuthenticatedUser, 'id'>,
  ): Promise<void> {
    const aReprendre = await this.prisma.prospect.count({
      where: { createdById: id, deletedAt: null },
    });
    const representants = await this.prisma.representant.count({
      where: { createdById: id, deletedAt: null },
    });
    if (aReprendre === 0 && representants === 0) return;

    if (!handoverToId) {
      throw new BadRequestException({
        code: 'HANDOVER_REQUIRED',
        message:
          `Ce compte détient ${String(aReprendre)} prospect(s) et ${String(representants)} ` +
          'représentant(s) : désignez le téléconseiller qui les reprend.',
      });
    }
    if (handoverToId === id) {
      throw new BadRequestException({
        code: 'HANDOVER_TO_SELF',
        message: 'Le repreneur doit être un autre compte.',
      });
    }

    const repreneur = await this.prisma.user.findFirst({
      where: { id: handoverToId, isActive: true, deletedAt: null },
      select: { id: true, role: true, fullName: true },
    });
    if (!repreneur || repreneur.role !== Role.COMMERCIAL) {
      throw new BadRequestException({
        code: 'HANDOVER_TARGET_INVALID',
        message: 'Le repreneur doit être un téléconseiller actif.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.prospect.updateMany({
        where: { createdById: id, deletedAt: null },
        data: { createdById: handoverToId },
      });
      await tx.representant.updateMany({
        where: { createdById: id, deletedAt: null },
        data: { createdById: handoverToId },
      });
      await audit(tx, actor, {
        action: AuditAction.PORTFOLIO_HANDOVER,
        entity: 'user',
        entityId: id,
        before: { prospects: aReprendre, representants },
        after: { handoverToId, handoverToName: repreneur.fullName },
      });
    });
  }

  async resetPassword(
    id: string,
    input: ResetPasswordDto,
    actor: Pick<AuthenticatedUser, 'id'>,
  ): Promise<{ ok: boolean }> {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Compte introuvable.' });
    }
    const passwordHash = await hashPassword(input.password);
    // La trace appartient à la MÊME transaction : écrite dehors, elle
    // survivrait à une réinitialisation annulée.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await audit(tx, actor, {
        action: AuditAction.USER_RESET_PASSWORD,
        entity: 'user',
        entityId: id,
      });
    });
    // Un mot de passe réinitialisé doit invalider les sessions en cours, sinon
    // l'intrus dont on vient de couper l'accès garde une session vivante.
    await this.revokeSessions(id);
    return { ok: true };
  }

  async remove(
    id: string,
    actor: Pick<AuthenticatedUser, 'id'>,
    handoverToId?: string,
  ): Promise<{ ok: boolean }> {
    const actingUserId = actor.id;
    if (id === actingUserId) {
      throw new BadRequestException({
        code: 'CANNOT_DELETE_SELF',
        message: 'Un administrateur ne peut pas supprimer son propre compte.',
      });
    }
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Compte introuvable.' });
    }

    await this.handOverPortfolio(id, handoverToId, actor);

    // Suppression logique : les prospects et représentants saisis par ce
    // commercial restent en base et gardent leur paternité. Une suppression
    // physique casserait les clés étrangères Restrict et effacerait l'historique
    // commercial d'un départ.
    await this.prisma.$transaction(async (tx) => {
      await this.assertAdminSurvives(tx, existing, actor, undefined, false);
      await tx.user.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
      await audit(tx, actor, {
        action: AuditAction.USER_DELETE,
        entity: 'user',
        entityId: id,
        before: { email: existing.email, role: existing.role },
      });
    });
    await this.revokeSessions(id);
    return { ok: true };
  }

  private async revokeSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async assertIdentifiersFree(email?: string, username?: string): Promise<void> {
    const or: Prisma.UserWhereInput[] = [];
    if (email) or.push({ email: email.trim().toLowerCase() });
    if (username) or.push({ username: username.trim().toLowerCase() });
    if (!or.length) return;

    const clash = await this.prisma.user.findFirst({ where: { OR: or } });
    if (!clash) return;
    throw new ConflictException({
      code: 'USER_IDENTIFIER_TAKEN',
      message:
        clash.email === email?.trim().toLowerCase()
          ? 'Cette adresse e-mail est déjà utilisée.'
          : 'Ce nom d’utilisateur est déjà utilisé.',
      field: clash.email === email?.trim().toLowerCase() ? 'email' : 'username',
    });
  }
}
