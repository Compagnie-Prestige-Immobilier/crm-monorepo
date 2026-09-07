import { createHash, randomUUID } from 'node:crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { readEnv } from '../../env.js';
import { AuditAction, audit } from '../../common/audit.js';
import { WorkspaceContext, type Workspace } from '../../workspaces/workspace.js';
import { DemoService } from '../demo/demo.service.js';
import { hashPassword, verifyPassword } from './password.js';
import type { AuthTokensDto, AuthUserDto } from './dto.js';
import type { OkDto } from '../../common/dto/ok.dto.js';

// `refresh_tokens` ne stocke JAMAIS le jeton en clair. SHA-256 nu et non argon2 :
// le jeton est déjà une valeur aléatoire de haute entropie, et le refresh doit rester rapide.
const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

// Condensat factice payé quand l'identifiant est inconnu : sans lui, un compte
// inexistant répondrait plus vite qu'un mauvais mot de passe, et se laisserait énumérer.
let decoyDigest: string | undefined;
async function decoy(): Promise<string> {
  decoyDigest ??= await hashPassword(randomUUID());
  return decoyDigest;
}

interface RefreshTokenPayload {
  sub: string;
  jti: string;
  fam: string;
  typ: string;
  workspace?: Workspace;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly workspace: WorkspaceContext,
    private readonly demo: DemoService,
  ) {}

  async login(identifier: string, password: string, userAgent?: string): Promise<AuthTokensDto> {
    const trimmed = identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: { equals: trimmed, mode: 'insensitive' } },
          { username: { equals: trimmed, mode: 'insensitive' } },
        ],
      },
    });

    const digest = user?.passwordHash ?? (await decoy());
    const ok = await verifyPassword(digest, password);
    if (!user || !ok) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Identifiants invalides.',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'Ce compte est désactivé. Contactez un administrateur.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issue(user, randomUUID(), userAgent, 'public');
  }

  // Rotation dans la MÊME famille. Un jeton déjà consommé qui se represente est un
  // rejeu : on ne sait pas qui du client ou du voleur parle, donc toute la famille tombe.
  async refresh(presented: string, userAgent?: string): Promise<AuthTokensDto> {
    const env = readEnv();
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwt.verify<RefreshTokenPayload>(presented, {
        secret: env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Session expirée. Reconnectez-vous.',
      });
    }
    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Session expirée. Reconnectez-vous.',
      });
    }

    const tokenHash = hashRefreshToken(presented);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Session expirée. Reconnectez-vous.',
      });
    }

    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      this.logger.warn(
        `Rejeu de refresh token détecté (famille ${stored.familyId}), famille révoquée`,
      );
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REPLAYED',
        message: 'Session compromise. Reconnectez-vous.',
      });
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Session expirée. Reconnectez-vous.',
      });
    }

    if (!stored.user.isActive || stored.user.deletedAt) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'Ce compte est désactivé. Contactez un administrateur.',
      });
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issue(stored.user, stored.familyId, userAgent, payload.workspace ?? 'public');
  }

  async switchWorkspace(
    userId: string,
    workspace: Workspace,
    userAgent?: string,
  ): Promise<AuthTokensDto> {
    this.workspace.enter('public');
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'Ce compte est désactivé. Contactez un administrateur.',
      });
    }
    if (workspace === 'demo') {
      this.demo.assertEnabled();
      await this.demo.ensureSeeded();
    }
    return this.issue(user, randomUUID(), userAgent, workspace);
  }

  async logout(presented: string): Promise<boolean> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(presented) },
    });
    if (!stored) return false;
    await this.revokeFamily(stored.familyId);
    return true;
  }

  async me(userId: string, workspace: Workspace): Promise<AuthUserDto> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Compte introuvable.',
      });
    }
    return toAuthUser(user, workspace);
  }

  // Changement volontaire de son propre mot de passe : la session courante reste
  // ouverte. On ne révoque AUCUNE session : le contexte (@CurrentUser, jeton
  // d'accès) ne porte pas la famille du refresh token courant — seul le refresh
  // token lui-même, absent ici, la désigne — donc on ne peut pas révoquer « les
  // autres » sans couper aussi la session en cours. Les autres appareils gardent
  // leur session jusqu'à expiration ou déconnexion.
  async changeMyPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<OkDto> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Compte introuvable.',
      });
    }

    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Le mot de passe actuel est incorrect.',
      });
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await audit(
        tx,
        { id: userId },
        {
          action: AuditAction.USER_CHANGE_OWN_PASSWORD,
          entity: 'user',
          entityId: userId,
        },
      );
    });

    return { ok: true };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issue(
    user: User,
    familyId: string,
    userAgent?: string,
    workspace: Workspace = 'public',
  ): Promise<AuthTokensDto> {
    const env = readEnv();
    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        workspace,
        typ: 'access',
      },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: ttlToSeconds(env.JWT_ACCESS_TTL) },
    );

    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000);
    const refreshToken = this.jwt.sign(
      { sub: user.id, jti, fam: familyId, typ: 'refresh', workspace },
      { secret: env.JWT_REFRESH_SECRET, expiresIn: env.JWT_REFRESH_TTL_DAYS * 86_400 },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        familyId,
        expiresAt,
        ...(userAgent ? { userAgent: userAgent.slice(0, 250) } : {}),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: ttlToSeconds(env.JWT_ACCESS_TTL),
      user: toAuthUser(user, workspace),
    };
  }
}

function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)\s*([smhd]?)$/.exec(ttl.trim());
  if (!match) return 900;
  const amount = Number(match[1]);
  switch (match[2]) {
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 3600;
    case 'd':
      return amount * 86_400;
    default:
      return amount;
  }
}

function toAuthUser(user: User, workspace: Workspace = 'public'): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    workspace,
    phoneE164: user.phoneE164,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}
