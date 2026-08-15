import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizePhone } from '../../common/phone.js';
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
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';

type UserRow = Prisma.UserGetPayload<{
  include: { departement: { select: { name: true } }; _count: { select: { prospects: true } } };
}>;

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async list(query: UserListQueryDto): Promise<UserListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...demoScope(await this.demo.enabled()),
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

  async create(input: CreateUserDto): Promise<UserDto> {
    await this.assertIdentifiersFree(input.email, input.username);

    const user = await this.prisma.user.create({
      data: {
        email: input.email.trim().toLowerCase(),
        username: input.username.trim().toLowerCase(),
        fullName: input.fullName.trim(),
        passwordHash: await hashPassword(input.password),
        role: input.role ?? Role.COMMERCIAL,
        ...(input.departementId ? { departementId: input.departementId } : {}),
        ...(input.phone ? { phoneE164: normalizePhone(input.phone) } : {}),
        // Un compte est une racine : rien dont hériter, l'interrupteur décide
        // seul.
        //
        // L'asymétrie est ce qui rendait l'omission visible : `list()`
        // cloisonne DÉJÀ par `demoScope`. Le compte ouvert pendant une
        // démonstration disparaissait donc de l'écran qui aurait permis de le
        // voir, tout en restant en base et connectable.
        isDemo: await this.demo.enabled(),
      },
      include: INCLUDE,
    });
    return toDto(user);
  }

  async update(id: string, input: UpdateUserDto): Promise<UserDto> {
    const existing = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Compte introuvable.' });
    }

    const email = input.email?.trim().toLowerCase();
    const username = input.username?.trim().toLowerCase();
    await this.assertIdentifiersFree(
      email && email !== existing.email ? email : undefined,
      username && username !== existing.username ? username : undefined,
    );

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(email ? { email } : {}),
        ...(username ? { username } : {}),
        ...(input.fullName ? { fullName: input.fullName.trim() } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.departementId !== undefined ? { departementId: input.departementId } : {}),
        ...(input.phone !== undefined
          ? { phoneE164: input.phone ? normalizePhone(input.phone) : null }
          : {}),
      },
      include: INCLUDE,
    });

    // Désactiver un compte doit couper ses sessions ouvertes : sans cela le
    // porteur d'un access token continue de travailler jusqu'à son expiration
    // et son refresh token reste valable des semaines.
    if (input.isActive === false) await this.revokeSessions(id);

    return toDto(user);
  }

  async setActive(id: string, input: SetActiveDto, actingUserId: string): Promise<UserDto> {
    if (id === actingUserId && !input.isActive) {
      throw new BadRequestException({
        code: 'CANNOT_DEACTIVATE_SELF',
        message: 'Un administrateur ne peut pas désactiver son propre compte.',
      });
    }
    return this.update(id, { isActive: input.isActive });
  }

  async resetPassword(id: string, input: ResetPasswordDto): Promise<{ ok: boolean }> {
    const existing = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Compte introuvable.' });
    }
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(input.password) },
    });
    // Un mot de passe réinitialisé doit invalider les sessions en cours, sinon
    // l'intrus dont on vient de couper l'accès garde une session vivante.
    await this.revokeSessions(id);
    return { ok: true };
  }

  async remove(id: string, actingUserId: string): Promise<{ ok: boolean }> {
    if (id === actingUserId) {
      throw new BadRequestException({
        code: 'CANNOT_DELETE_SELF',
        message: 'Un administrateur ne peut pas supprimer son propre compte.',
      });
    }
    const existing = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Compte introuvable.' });
    }

    // Suppression logique : les prospects et représentants saisis par ce
    // commercial restent en base et gardent leur paternité. Une suppression
    // physique casserait les clés étrangères Restrict et effacerait l'historique
    // commercial d'un départ.
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
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

  /**
   * LECTURE GLOBALE délibérée : l'unicité de l'e-mail et de l'identifiant est
   * globale en base. Filtrée, elle laisserait créer un compte réel portant
   * l'identifiant d'un compte de démonstration, et la contrainte le refuserait
   * ensuite sans que l'administrateur comprenne quel compte le lui prend.
   */
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
