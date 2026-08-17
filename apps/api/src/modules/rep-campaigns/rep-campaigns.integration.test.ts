process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import { CallTaskStatus, CampaignStatus, PrismaClient, PrismaPg, Role } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { shuffleInPostgres, toPostgresSeed } from '../phase2/distribution.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TAG = 'ITRC';

const SEED_A = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';
const SEED_B = 'ffeeddccbbaa99887766554433221100';

let departementId: string;
let adminId: string;
let commercialId: string;
let representantIds: string[] = [];

async function cleanupCampagnes(): Promise<void> {
  await prisma.repCallAttempt.deleteMany({ where: { campaign: { name: { startsWith: TAG } } } });
  await prisma.repCallTask.deleteMany({ where: { campaign: { name: { startsWith: TAG } } } });
  await prisma.repCallCampaignCommercial.deleteMany({
    where: { campaign: { name: { startsWith: TAG } } },
  });
  await prisma.repCallCampaign.deleteMany({ where: { name: { startsWith: TAG } } });
}

async function cleanupAll(): Promise<void> {
  await cleanupCampagnes();
  await prisma.representant.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG.toLowerCase() } } });
}

beforeAll(async () => {
  await cleanupAll();

  const departement = await prisma.departement.findFirstOrThrow({ select: { id: true } });
  departementId = departement.id;

  const [admin, commercial] = await Promise.all([
    prisma.user.create({
      data: {
        id: uuidv7(),
        username: `${TAG.toLowerCase()}-admin`,
        email: `${TAG.toLowerCase()}-admin@cpi.sn`,
        fullName: `${TAG} Admin`,
        passwordHash: 'x',
        role: Role.ADMIN,
      },
      select: { id: true },
    }),
    prisma.user.create({
      data: {
        id: uuidv7(),
        username: `${TAG.toLowerCase()}-com`,
        email: `${TAG.toLowerCase()}-com@cpi.sn`,
        fullName: `${TAG} Commercial`,
        passwordHash: 'x',
        role: Role.COMMERCIAL,
        departementId,
      },
      select: { id: true },
    }),
  ]);
  adminId = admin.id;
  commercialId = commercial.id;

  representantIds = [];
  for (let index = 0; index < 40; index += 1) {
    const row = await prisma.representant.create({
      data: {
        id: uuidv7(),
        fullName: `${TAG} Rep ${String(index).padStart(2, '0')}`,
        phoneE164: `+2217709920${String(index).padStart(2, '0')}`,
        departementId,
        createdById: commercialId,
        clientCreatedAt: new Date('2026-01-02T09:00:00.000Z'),
      },
      select: { id: true },
    });
    representantIds.push(row.id);
  }
});

afterAll(async () => {
  await cleanupAll();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanupCampagnes();
});

async function tirage(nom: string, seed: string): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const campagne = await tx.repCallCampaign.create({
      data: {
        id: uuidv7(),
        name: `${TAG} ${nom}`,
        seed,
        spreadDays: 1,
        status: CampaignStatus.ACTIVE,
        createdById: adminId,
        departementId,
      },
      select: { id: true },
    });

    const ordonnes = await shuffleInPostgres(tx, seed, representantIds);

    await tx.repCallTask.createMany({
      data: ordonnes.map((representantId, index) => ({
        id: uuidv7(),
        campaignId: campagne.id,
        representantId,
        assignedToId: commercialId,
        position: index + 1,
        dayIndex: 0,
        status: CallTaskStatus.OPEN,
        isActive: false,
      })),
    });

    return ordonnes;
  });
}

describe('mélange ensemencé : deux campagnes, même graine, même ordre', () => {
  it('même graine et même population donnent un ordre IDENTIQUE', async () => {
    const premier = await tirage('Campagne 1', SEED_A);
    const second = await tirage('Campagne 2', SEED_A);

    expect(second).toEqual(premier);
    expect(premier).toHaveLength(representantIds.length);
  });

  it('deux graines DIFFÉRENTES donnent un ordre différent', async () => {
    const avecA = await tirage('Campagne A', SEED_A);
    const avecB = await tirage('Campagne B', SEED_B);

    expect(avecB).not.toEqual(avecA);
    expect([...avecB].sort()).toEqual([...avecA].sort());
  });

  it('le mélange bouscule réellement l’ordre d’entrée', async () => {
    const ordonnes = await tirage('Campagne mélangée', SEED_A);
    expect(ordonnes).not.toEqual(representantIds);
    expect([...ordonnes].sort()).toEqual([...representantIds].sort());
  });

  it('la graine reste dans l’intervalle admis par setseed', () => {
    for (const seed of [SEED_A, SEED_B]) {
      expect(toPostgresSeed(seed)).toBeGreaterThanOrEqual(-1);
      expect(toPostgresSeed(seed)).toBeLessThan(1);
    }
  });
});

describe('index rep_call_tasks_one_active_per_representant', () => {
  const tacheActive = async (nom: string, representantId: string): Promise<void> => {
    const campagne = await prisma.repCallCampaign.create({
      data: {
        id: uuidv7(),
        name: `${TAG} ${nom}`,
        seed: SEED_A,
        spreadDays: 1,
        status: CampaignStatus.ACTIVE,
        createdById: adminId,
        departementId,
      },
      select: { id: true },
    });

    await prisma.repCallTask.create({
      data: {
        id: uuidv7(),
        campaignId: campagne.id,
        representantId,
        assignedToId: commercialId,
        position: 1,
        dayIndex: 0,
        status: CallTaskStatus.OPEN,
        isActive: true,
      },
    });
  };

  it('REFUSE une deuxième tâche ACTIVE sur le même représentant', async () => {
    const cible = representantIds[0] ?? '';
    await tacheActive('Première', cible);

    const erreur = await tacheActive('Seconde', cible)
      .then(() => null)
      .catch((caught: unknown) => (caught as { code?: string }).code ?? String(caught));

    expect(erreur).toBe('P2002');
    expect(
      await prisma.repCallTask.count({ where: { representantId: cible, isActive: true } }),
    ).toBe(1);
  });

  it('AUTORISE une nouvelle tâche quand la précédente n’est plus active', async () => {
    const cible = representantIds[1] ?? '';
    await tacheActive('Ancienne', cible);

    await prisma.repCallTask.updateMany({
      where: { representantId: cible, isActive: true },
      data: { isActive: false, status: CallTaskStatus.DONE },
    });

    await expect(tacheActive('Nouvelle', cible)).resolves.toBeUndefined();

    expect(await prisma.repCallTask.count({ where: { representantId: cible } })).toBe(2);
    expect(
      await prisma.repCallTask.count({ where: { representantId: cible, isActive: true } }),
    ).toBe(1);
  });

  it('AUTORISE deux tâches actives sur deux représentants distincts', async () => {
    await tacheActive('Un', representantIds[2] ?? '');
    await tacheActive('Deux', representantIds[3] ?? '');

    expect(
      await prisma.repCallTask.count({
        where: { isActive: true, campaign: { name: { startsWith: TAG } } },
      }),
    ).toBe(2);
  });
});
