process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';

import { PrismaClient, PrismaPg, Role } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { CLES, cleStockee } from '../parametres-chues/parametres.js';
import { ParametresChuesService } from '../parametres-chues/parametres-chues.service.js';
import { OuverturesService } from './ouvertures.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const client = prisma as unknown as PrismaService;
const parametres = new ParametresChuesService(client);
const service = new OuverturesService(client, parametres);

const TAG = 'it-verrou';
const reglages = { key: { in: CLES.map(cleStockee) } };

async function compte(nom: string, role: Role): Promise<AuthenticatedUser> {
  const row = await prisma.user.create({
    data: {
      id: uuidv7(),
      email: `${TAG}.${nom}@test.local`,
      username: `${TAG}-${nom}`,
      passwordHash: 'x',
      fullName: `${TAG} ${nom}`,
      role,
    },
    select: { id: true, email: true, username: true, fullName: true, role: true },
  });
  return row;
}

async function prospect(createdById: string, suffixe: string): Promise<string> {
  const row = await prisma.prospect.create({
    data: {
      id: uuidv7(),
      nom: 'Verrou',
      prenom: suffixe,
      phoneE164: `+22177099${suffixe}`,
      createdById,
      clientCreatedAt: new Date(),
    },
    select: { id: true },
  });
  return row.id;
}

interface ErrorBody {
  code?: string;
}
const bodyOf = (error: unknown): ErrorBody => (error as { response?: unknown }).response ?? {};

async function refus(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('aucune exception levée alors qu’un refus était attendu');
}

async function vider(): Promise<void> {
  await prisma.ouvertureFiche.deleteMany({
    where: { openedBy: { username: { startsWith: TAG } } },
  });
  await prisma.prospect.deleteMany({ where: { createdBy: { username: { startsWith: TAG } } } });
  await prisma.appSettingChange.deleteMany({ where: reglages });
  await prisma.appSetting.deleteMany({ where: reglages });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG } } });
}

beforeEach(vider);

afterAll(async () => {
  await vider();
  await prisma.$disconnect();
});

describe('EB-29 verrou de fiche parametrable', () => {
  it('verrou coupe : ouvrir une autre fiche ferme la premiere sans la qualifier', async () => {
    const admin = await compte('admin1', Role.ADMIN);
    const awa = await compte('awa1', Role.COMMERCIAL);
    await parametres.ecrire(admin, { verrouFiches: false });

    const premiere = await service.ouvrir(awa, {
      id: uuidv7(),
      prospectId: await prospect(awa.id, '1'),
      openedAt: new Date().toISOString(),
    });

    await service.ouvrir(awa, {
      id: uuidv7(),
      prospectId: await prospect(awa.id, '2'),
      openedAt: new Date().toISOString(),
    });

    const relue = await prisma.ouvertureFiche.findUniqueOrThrow({ where: { id: premiere.id } });
    expect(relue.closedAt).not.toBeNull();
    expect(relue.closingAttemptId).toBeNull();
    expect(relue.releasedById).toBeNull();
  });

  it('verrou actif : ouvrir une autre fiche est refusee', async () => {
    const admin = await compte('admin2', Role.ADMIN);
    const awa = await compte('awa2', Role.COMMERCIAL);
    await parametres.ecrire(admin, { verrouFiches: true });

    await service.ouvrir(awa, {
      id: uuidv7(),
      prospectId: await prospect(awa.id, '3'),
      openedAt: new Date().toISOString(),
    });

    const prospectId = await prospect(awa.id, '4');
    const erreur = await refus(() =>
      service.ouvrir(awa, { id: uuidv7(), prospectId, openedAt: new Date().toISOString() }),
    );
    expect(bodyOf(erreur).code).toBe('OUVERTURE_FICHE_DEJA_OUVERTE');
  });
});
