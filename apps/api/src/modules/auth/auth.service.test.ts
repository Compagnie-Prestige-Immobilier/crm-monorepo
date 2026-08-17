import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@crm/database';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService, hashRefreshToken, toAuthUser, ttlToSeconds } from './auth.service.js';
import { ARGON2_OPTIONS, hashPassword, verifyPassword } from './password.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

const ACCESS_SECRET = 'x'.repeat(40);
const REFRESH_SECRET = 'y'.repeat(40);

beforeAll(() => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm';
  process.env.JWT_ACCESS_SECRET = ACCESS_SECRET;
  process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;
});

interface PrismaMock {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  refreshToken: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
}

const userRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'com-alice',
  email: 'alice@cpi.sn',
  username: 'alice',
  fullName: 'Alice Diop',
  passwordHash: 'remplacé-par-le-test',
  role: Role.COMMERCIAL,
  isActive: true,
  isDemo: false,
  lastLoginAt: null,
  departementId: null,
  phoneE164: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

interface PrismaCallArgs {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

function firstArg(fn: ReturnType<typeof vi.fn>): PrismaCallArgs {
  return (fn.mock.calls[0]?.[0] ?? {}) as PrismaCallArgs;
}

let prisma: PrismaMock;
let auth: AuthService;

beforeEach(() => {
  prisma = {
    user: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    refreshToken: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  auth = new AuthService(
    prisma as unknown as PrismaService,
    new JwtService({}),
    fakeDemoVisibility(),
  );
});

const authWithDemo = (demo: boolean | 'unknown'): AuthService =>
  new AuthService(prisma as unknown as PrismaService, new JwtService({}), fakeDemoVisibility(demo));

describe('paramètres argon2id', () => {
  it('correspondent EXACTEMENT à ceux du seed', () => {
    expect(ARGON2_OPTIONS.memoryCost).toBe(19_456);
    expect(ARGON2_OPTIONS.timeCost).toBe(2);
    expect(ARGON2_OPTIONS.parallelism).toBe(1);
  });

  it('vérifie un condensat produit avec ces paramètres', async () => {
    const digest = await hashPassword('ChangeMoiEnProd2026');
    expect(digest.startsWith('$argon2id$')).toBe(true);
    expect(digest).toContain('m=19456,p=1,t=2');
    await expect(verifyPassword(digest, 'ChangeMoiEnProd2026')).resolves.toBe(true);
    await expect(verifyPassword(digest, 'mauvais')).resolves.toBe(false);
  });

  it('traite un condensat corrompu comme un mot de passe faux, pas comme une panne', async () => {
    await expect(verifyPassword('pas-un-condensat', 'peu-importe')).resolves.toBe(false);
  });
});

describe('login', () => {
  it('rend un message IDENTIQUE pour compte inconnu et mot de passe faux', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const unknownAccount = await auth
      .login('fantome@cpi.sn', 'motdepasse')
      .catch((e: unknown) => e);

    prisma.user.findFirst.mockResolvedValue(
      userRow({ passwordHash: await hashPassword('le-bon-mot-de-passe') }),
    );
    const wrongPassword = await auth.login('alice@cpi.sn', 'le-mauvais').catch((e: unknown) => e);

    expect(unknownAccount).toBeInstanceOf(UnauthorizedException);
    expect(wrongPassword).toBeInstanceOf(UnauthorizedException);
    expect((unknownAccount as UnauthorizedException).getResponse()).toEqual(
      (wrongPassword as UnauthorizedException).getResponse(),
    );
  });

  it('accepte l’e-mail OU le nom d’utilisateur', async () => {
    prisma.user.findFirst.mockResolvedValue(
      userRow({ passwordHash: await hashPassword('secret12') }),
    );
    await auth.login('alice', 'secret12');

    const where = firstArg(prisma.user.findFirst).where ?? {};
    expect(where.OR).toHaveLength(2);
  });

  it('refuse un compte désactivé, avec un code distinct et actionnable', async () => {
    prisma.user.findFirst.mockResolvedValue(
      userRow({ passwordHash: await hashPassword('secret12'), isActive: false }),
    );

    const error = (await auth
      .login('alice', 'secret12')
      .catch((e: unknown) => e)) as UnauthorizedException;
    expect(error.getResponse()).toMatchObject({ code: 'ACCOUNT_DISABLED' });
  });

  it('ne stocke que le SHA-256 du refresh token, jamais le jeton', async () => {
    prisma.user.findFirst.mockResolvedValue(
      userRow({ passwordHash: await hashPassword('secret12') }),
    );

    const tokens = await auth.login('alice', 'secret12');
    const stored = firstArg(prisma.refreshToken.create).data ?? {};

    expect(stored.tokenHash).toBe(hashRefreshToken(tokens.refreshToken));
    expect(stored.tokenHash).not.toBe(tokens.refreshToken);
    expect(JSON.stringify(prisma.refreshToken.create.mock.calls)).not.toContain(
      tokens.refreshToken,
    );
  });
});

describe('comptes de démonstration, mode éteint', () => {
  const demoRow = async (): Promise<Record<string, unknown>> =>
    userRow({
      id: 'demo-admin',
      email: 'demo.admin@cpi.sn',
      username: 'demo.admin',
      role: Role.ADMIN,
      isDemo: true,
      passwordHash: await hashPassword('Demo1-CPI-Sunugal'),
    });

  it('LE COMPTE ADMIN DE DÉMONSTRATION NE PEUT PAS SE CONNECTER', async () => {
    prisma.user.findFirst.mockResolvedValue(await demoRow());

    const error = (await authWithDemo(false)
      .login('demo.admin@cpi.sn', 'Demo1-CPI-Sunugal')
      .catch((e: unknown) => e)) as UnauthorizedException;

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.getResponse()).toMatchObject({ code: 'ACCOUNT_DISABLED' });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('le même compte se connecte NORMALEMENT pendant la démonstration', async () => {
    prisma.user.findFirst.mockResolvedValue(await demoRow());

    const tokens = await authWithDemo(true).login('demo.admin@cpi.sn', 'Demo1-CPI-Sunugal');
    expect(tokens.accessToken).toBeTruthy();
  });

  it('une lecture de réglage EN ÉCHEC refuse, elle ne laisse pas entrer', async () => {
    prisma.user.findFirst.mockResolvedValue(await demoRow());

    const error = (await authWithDemo('unknown')
      .login('demo.admin@cpi.sn', 'Demo1-CPI-Sunugal')
      .catch((e: unknown) => e)) as UnauthorizedException;

    expect(error.getResponse()).toMatchObject({ code: 'ACCOUNT_DISABLED' });
  });

  it('un compte RÉEL n’est pas touché par l’interrupteur', async () => {
    prisma.user.findFirst.mockResolvedValue(
      userRow({ passwordHash: await hashPassword('secret12') }),
    );
    await expect(authWithDemo(false).login('alice', 'secret12')).resolves.toBeTruthy();
  });

  it('la session DÉJÀ OUVERTE meurt au renouvellement, et sa famille est révoquée', async () => {
    const token = new JwtService({}).sign(
      { sub: 'demo-admin', jti: 'j1', fam: 'fam-demo', typ: 'refresh' },
      { secret: REFRESH_SECRET, expiresIn: 3600 },
    );
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-demo',
      familyId: 'fam-demo',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      user: await demoRow(),
    });

    const error = (await authWithDemo(false)
      .refresh(token)
      .catch((e: unknown) => e)) as UnauthorizedException;

    expect(error.getResponse()).toMatchObject({ code: 'ACCOUNT_DISABLED' });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { familyId: 'fam-demo', revokedAt: null } }),
    );
  });
});

describe('rotation et détection de rejeu', () => {
  const issueRefresh = (fam: string): string =>
    new JwtService({}).sign(
      { sub: 'com-alice', jti: 'j1', fam, typ: 'refresh' },
      { secret: REFRESH_SECRET, expiresIn: 3600 },
    );

  it('révoque TOUTE la famille quand un jeton déjà consommé est représenté', async () => {
    const token = issueRefresh('fam-1');
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      familyId: 'fam-1',
      revokedAt: new Date('2026-08-01T00:00:00.000Z'),
      expiresAt: new Date(Date.now() + 3_600_000),
      user: userRow(),
    });

    const error = (await auth.refresh(token).catch((e: unknown) => e)) as UnauthorizedException;

    expect(error.getResponse()).toMatchObject({ code: 'REFRESH_TOKEN_REPLAYED' });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { familyId: 'fam-1', revokedAt: null } }),
    );
  });

  it('tourne le jeton en conservant la famille', async () => {
    const token = issueRefresh('fam-1');
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      familyId: 'fam-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      user: userRow(),
    });

    const rotated = await auth.refresh(token);

    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt-1' } }),
    );
    expect(firstArg(prisma.refreshToken.create).data?.familyId).toBe('fam-1');
    expect(rotated.refreshToken).not.toBe(token);
  });

  it('refuse un jeton d’accès présenté à la place d’un refresh token', async () => {
    const accessToken = new JwtService({}).sign(
      { sub: 'com-alice', typ: 'access' },
      { secret: REFRESH_SECRET, expiresIn: 3600 },
    );

    const error = (await auth
      .refresh(accessToken)
      .catch((e: unknown) => e)) as UnauthorizedException;
    expect(error.getResponse()).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('refuse un jeton expiré', async () => {
    const token = issueRefresh('fam-1');
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      familyId: 'fam-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
      user: userRow(),
    });

    const error = (await auth.refresh(token).catch((e: unknown) => e)) as UnauthorizedException;
    expect(error.getResponse()).toMatchObject({ code: 'REFRESH_TOKEN_EXPIRED' });
  });

  it('coupe la session d’un compte désactivé entre-temps', async () => {
    const token = issueRefresh('fam-1');
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      familyId: 'fam-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      user: userRow({ isActive: false }),
    });

    const error = (await auth.refresh(token).catch((e: unknown) => e)) as UnauthorizedException;
    expect(error.getResponse()).toMatchObject({ code: 'ACCOUNT_DISABLED' });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('la déconnexion est muette sur un jeton inconnu', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(auth.logout('jeton-inconnu')).resolves.toBe(false);
  });
});

describe('ttlToSeconds', () => {
  it.each([
    ['15m', 900],
    ['2h', 7200],
    ['7d', 604_800],
    ['30s', 30],
    ['3600', 3600],
    ['n’importe quoi', 900],
  ])('« %s » → %i s', (input, expected) => {
    expect(ttlToSeconds(input)).toBe(expected);
  });
});

describe('toAuthUser', () => {
  it('ne laisse jamais fuir le condensat du mot de passe', () => {
    const dto = toAuthUser(userRow({ passwordHash: 'SECRET' }) as never);
    expect(JSON.stringify(dto)).not.toContain('SECRET');
    expect(dto).not.toHaveProperty('passwordHash');
  });
});
