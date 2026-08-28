import { PrismaClient, PrismaPg, Role } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { ProspectsService } from './prospects.service.js';

const RUN = uuidv7().slice(0, 8);
const DATABASE_URL = process.env.DATABASE_URL ?? readRootEnv();

function readRootEnv(): string {
  try {
    process.loadEnvFile(new URL('../../../../../.env', import.meta.url).pathname);
  } catch {}
  return process.env.DATABASE_URL ?? '';
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
const prospects = new ProspectsService(prisma as unknown as PrismaService);

let awa: AuthenticatedUser;
let omar: AuthenticatedUser;
let admin: AuthenticatedUser;
let confiee = '';
let orpheline = '';
let dOmar = '';
let campaignId = '';

const identity = (row: {
  id: string;
  email: string;
  username: string;
  fullName: string;
}): AuthenticatedUser => ({ ...row, role: Role.COMMERCIAL });

beforeAll(async () => {
  if (!DATABASE_URL) throw new Error('DATABASE_URL doit être défini pour la suite d’intégration.');

  const makeUser = async (
    prefix: string,
    fullName: string,
    role: Role,
  ): Promise<AuthenticatedUser> => {
    const row = await prisma.user.create({
      data: {
        email: `${prefix}-${RUN}@cpi.test`,
        username: `${prefix}-${RUN}`,
        passwordHash: 'x',
        fullName,
        role,
      },
    });
    return { ...identity(row), role };
  };

  awa = await makeUser('portee-awa', 'Awa Sy', Role.COMMERCIAL);
  omar = await makeUser('portee-omar', 'Omar Ba', Role.COMMERCIAL);
  admin = await makeUser('portee-admin', 'Admin CPI', Role.ADMIN);

  const creerProspect = async (nom: string, createdById: string, rang: number): Promise<string> => {
    const id = uuidv7();
    await prisma.prospect.create({
      data: {
        id,
        nom,
        prenom: 'Fiche',
        phoneE164: `+22176${RUN.slice(0, 3)}${String(1000 + rang)}`,
        createdById,
        clientCreatedAt: new Date('2026-08-02T09:00:00.000Z'),
      },
    });
    return id;
  };

  confiee = await creerProspect(`Confiee${RUN}`, admin.id, 1);
  orpheline = await creerProspect(`Orpheline${RUN}`, admin.id, 2);
  dOmar = await creerProspect(`DOmar${RUN}`, omar.id, 3);

  const campaign = await prisma.callCampaign.create({
    data: { name: `Portée ${RUN}`, scope: 'ALL', seed: RUN, createdById: admin.id },
  });
  campaignId = campaign.id;

  await prisma.callTask.create({
    data: { campaignId, prospectId: confiee, assignedToId: awa.id, position: 1 },
  });
});

afterAll(async () => {
  const ids = [confiee, orpheline, dOmar];
  await prisma.callTask.deleteMany({ where: { prospectId: { in: ids } } });
  await prisma.prospect.deleteMany({ where: { id: { in: ids } } });
  await prisma.callCampaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { id: { in: [awa.id, omar.id, admin.id] } } });
  await prisma.$disconnect();
});

const nomsVusPar = async (user: AuthenticatedUser): Promise<string[]> => {
  const page = await prospects.list(user, { pageSize: 200, search: RUN });
  return page.items.map((row) => row.nom).toSorted();
};

describe('la portée des prospects est la MÊME au panneau et sur le téléphone', () => {
  it('la fiche confiée par une campagne remonte dans la liste du téléconseiller', async () => {
    expect(await nomsVusPar(awa)).toEqual([`Confiee${RUN}`]);
  });

  it('la fiche que personne n’a reçue reste invisible, comme celle d’un collègue', async () => {
    const vus = await nomsVusPar(awa);

    expect(vus).not.toContain(`Orpheline${RUN}`);
    expect(vus).not.toContain(`DOmar${RUN}`);
  });

  it('la file d’appel du web compte ce que le téléphone compte', async () => {
    const page = await prospects.list(awa, { pageSize: 200, search: RUN, phase2Status: 'PENDING' });

    expect(page.meta.total).toBe(1);
    expect(page.items[0]?.id).toBe(confiee);
  });

  it('la fiche confiée s’ouvre en détail, elle ne répond plus 403', async () => {
    await expect(prospects.get(awa, confiee)).resolves.toMatchObject({ id: confiee });
  });

  it('la fiche d’un collègue reste refusée en détail', async () => {
    await expect(prospects.get(awa, dOmar)).rejects.toMatchObject({ status: 403 });
  });

  it('une tâche retirée de la file retire aussi la fiche de la liste', async () => {
    await prisma.callTask.updateMany({ where: { prospectId: confiee }, data: { isActive: false } });

    try {
      expect(await nomsVusPar(awa)).toEqual([]);
    } finally {
      await prisma.callTask.updateMany({ where: { prospectId: confiee }, data: { isActive: true } });
    }
  });

  it('l’ADMIN, lui, voit les trois fiches', async () => {
    expect(await nomsVusPar(admin)).toEqual([`Confiee${RUN}`, `DOmar${RUN}`, `Orpheline${RUN}`]);
  });
});
