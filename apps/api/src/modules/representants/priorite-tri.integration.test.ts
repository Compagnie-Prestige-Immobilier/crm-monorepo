process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import { PrioriteTraitement, PrismaClient, PrismaPg, Role } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { RepresentantSortField } from './dto.js';
import { RepresentantsService } from './representants.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TAG = 'ITPRIO';

const ADMIN: AuthenticatedUser = {
  id: 'admin-it',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Admin CPI',
  role: Role.ADMIN,
};

let service: RepresentantsService;
let departementId: string;
let commercialId: string;
let compteur = 0;

async function cleanup(): Promise<void> {
  await prisma.representant.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG.toLowerCase() } } });
}

const creer = async (statutQualificationId: string | null): Promise<void> => {
  compteur += 1;
  await prisma.representant.create({
    data: {
      id: uuidv7(),
      fullName: `${TAG} Rep ${String(compteur)}`,
      phoneE164: `+2217755000${String(compteur).padStart(2, '0')}`,
      departementId,
      createdById: commercialId,
      clientCreatedAt: new Date('2026-01-02T09:00:00.000Z'),
      statutQualificationId,
    },
  });
};

// Par PRIORITÉ et non par code : ce test ne mesure que l'ordre des paliers, et
// les codes du référentiel se renomment sans le concerner.
const statutId = async (priorite: PrioriteTraitement): Promise<string> =>
  (
    await prisma.statutQualification.findFirstOrThrow({
      where: { priorite, isSystem: true },
      orderBy: { code: 'asc' },
      select: { id: true },
    })
  ).id;

beforeAll(async () => {
  await cleanup();
  service = new RepresentantsService(prisma as unknown as PrismaService);

  const departement = await prisma.departement.findFirstOrThrow({ select: { id: true } });
  departementId = departement.id;

  const commercial = await prisma.user.create({
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
  });
  commercialId = commercial.id;

  await creer(null);
  await creer(await statutId(PrioriteTraitement.BASSE));
  await creer(await statutId(PrioriteTraitement.NORMALE));
  await creer(await statutId(PrioriteTraitement.HAUTE));
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('l’annuaire trié par priorité de traitement', () => {
  it('rappelle HAUTE, puis NORMALE, puis BASSE, et jamais qualifié en dernier', async () => {
    const { items } = await service.list(ADMIN, {
      search: TAG,
      sortBy: RepresentantSortField.PRIORITE,
    });

    const priorites = await Promise.all(
      items.map(async (item) => {
        const row = await prisma.representant.findUniqueOrThrow({
          where: { id: item.id },
          select: { statutQualification: { select: { priorite: true } } },
        });
        return row.statutQualification?.priorite ?? null;
      }),
    );

    expect(priorites).toEqual([
      PrioriteTraitement.HAUTE,
      PrioriteTraitement.NORMALE,
      PrioriteTraitement.BASSE,
      null,
    ]);
  });
});
