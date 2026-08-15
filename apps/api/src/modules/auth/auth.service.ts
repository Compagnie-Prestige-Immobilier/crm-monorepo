import { createHash, randomUUID } from 'node:crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { readEnv } from '../../env.js';
import { hashPassword, verifyPassword } from './password.js';
import type { AuthTokensDto, AuthUserDto } from './dto.js';

/**
 * Condensat SHA-256 du refresh token.
 *
 * La table `refresh_tokens` ne contient JAMAIS le jeton en clair : une fuite de
 * la base ne livre donc aucune session utilisable. SHA-256 nu (et non argon2)
 * suffit ici, contrairement à un mot de passe, le jeton est une valeur
 * aléatoire de haute entropie, insensible aux attaques par dictionnaire, et la
 * vérification doit rester assez rapide pour tenir sur le chemin de refresh.
 */
export const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/**
 * Condensat argon2 factice, utilisé quand l'identifiant est inconnu.
 *
 * Sans lui, une requête sur un compte inexistant répondrait beaucoup plus vite
 * qu'une requête sur un compte existant avec un mauvais mot de passe : l'écart
 * suffit à énumérer les comptes valides. On paie donc toujours le coût d'une
 * vérification argon2.
 */
let decoyDigest: string | undefined;
async function decoy(): Promise<string> {
  decoyDigest ??= await hashPassword(randomUUID());
  return decoyDigest;
}

/**
 * `typ` est déclaré `string` : le contenu d'un jeton vérifié reste une donnée
 * externe. Le typer en littéral ferait considérer le contrôle de `typ` comme
 * mort alors qu'il empêche un jeton d'accès de passer pour un refresh token.
 */
interface RefreshTokenPayload {
  sub: string;
  jti: string;
  fam: string;
  typ: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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

    // Message strictement identique pour « compte inconnu » et « mot de passe
    // faux » : le distinguer transformerait le formulaire de connexion en
    // oracle d'existence de compte.
    const digest = user?.passwordHash ?? (await decoy());
    const ok = await verifyPassword(digest, password);
    if (!user || !ok) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Identifiants invalides.',
      });
    }

    // Le compte désactivé est distingué : ce n'est pas une information sur
    // l'existence d'un compte, elle n'est délivrée qu'après authentification
    // réussie, et l'utilisateur doit comprendre qu'il doit appeler l'admin.
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

    return this.issue(user, randomUUID(), userAgent);
  }

  /**
   * Rotation du refresh token, avec détection de rejeu par famille.
   *
   * Chaque rotation crée un jeton dans la MÊME famille. Représenter un jeton
   * déjà consommé signifie qu'il a été copié : on ne sait pas si c'est le
   * client légitime ou le voleur qui se présente, donc on révoque toute la
   * famille. Le pire cas est une reconnexion ; l'alternative serait de laisser
   * une session volée vivre indéfiniment.
   */
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

    return this.issue(stored.user, stored.familyId, userAgent);
  }

  /** Révoque la famille du jeton présenté : la déconnexion vaut pour l'appareil entier. */
  async logout(presented: string): Promise<boolean> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(presented) },
    });
    // Idempotent et muet : un jeton inconnu ne renseigne pas l'appelant sur
    // les sessions actives.
    if (!stored) return false;
    await this.revokeFamily(stored.familyId);
    return true;
  }

  async me(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Compte introuvable.',
      });
    }
    return toAuthUser(user);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issue(user: User, familyId: string, userAgent?: string): Promise<AuthTokensDto> {
    const env = readEnv();
    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        typ: 'access',
      },
      // Durée exprimée en secondes plutôt qu'en « 15m » : jsonwebtoken accepte
      // les deux, mais le nombre évite de dépendre du type littéral de `ms`.
      { secret: env.JWT_ACCESS_SECRET, expiresIn: ttlToSeconds(env.JWT_ACCESS_TTL) },
    );

    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000);
    const refreshToken = this.jwt.sign(
      { sub: user.id, jti, fam: familyId, typ: 'refresh' },
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
      user: toAuthUser(user),
    };
  }
}

/** Convertit `15m`, `3600`, `2h`, `7d` en secondes, pour l'exposer au client. */
export function ttlToSeconds(ttl: string): number {
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

export function toAuthUser(user: User): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    departementId: user.departementId,
    phoneE164: user.phoneE164,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}
