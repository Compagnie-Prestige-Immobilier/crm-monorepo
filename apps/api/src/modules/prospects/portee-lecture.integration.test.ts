import {
  LotExportCible,
  PrismaClient,
  PrismaPg,
  Projet,
  ProspectStatut,
  Role,
} from '@crm/database';
import type { Prisma } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { ProspectsService } from './prospects.service.js';

const RUN = uuidv7().slice(0, 8);
// Un second marqueur, sans lien textuel avec le premier : les fiches converties
// ne doivent PAS entrer dans les recherches `RUN` qui comptent la portée.
const CLOSING = uuidv7().slice(-8);
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
let clientele: AuthenticatedUser;
let sienne = '';
let confiee = '';
let dOmar = '';
let convertie = '';
let relue = '';
let lotId = '';

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
  clientele = await makeUser('portee-cc', 'Fatou Ndiaye', Role.CHARGE_CLIENTELE);

  const creerProspect = async (
    nom: string,
    createdById: string,
    rang: number,
    extra: Partial<Prisma.ProspectUncheckedCreateInput> = {},
  ): Promise<string> => {
    const id = uuidv7();
    await prisma.prospect.create({
      data: {
        id,
        nom,
        prenom: 'Fiche',
        phoneE164: `+22176${RUN.slice(0, 3)}${String(1000 + rang)}`,
        createdById,
        clientCreatedAt: new Date('2026-08-02T09:00:00.000Z'),
        ...extra,
      },
    });
    return id;
  };

  sienne = await creerProspect(`Sienne${RUN}`, awa.id, 1);
  confiee = await creerProspect(`Confiee${RUN}`, admin.id, 2);
  dOmar = await creerProspect(`DOmar${RUN}`, omar.id, 3);
  convertie = await creerProspect(`Convertie${CLOSING}`, omar.id, 4, {
    statut: ProspectStatut.CONVERTI,
  });
  relue = await creerProspect(`Relue${CLOSING}`, omar.id, 5, {
    statut: ProspectStatut.CONVERTI,
    revueAt: new Date('2026-08-03T09:00:00.000Z'),
    revueById: admin.id,
  });

  // La répartition est le seul lien entre une fiche et le téléconseiller qui
  // ne l'a pas créée : sans elle, il ne la voit pas.
  const lot = await prisma.lotExport.create({
    data: {
      name: `Campagne ${RUN}`,
      cible: LotExportCible.PROSPECTS,
      projet: Projet.CHUES,
      filters: {},
      itemCount: 2,
      createdById: admin.id,
      items: {
        create: [
          { position: 1, prospectId: confiee, assigneeId: awa.id, day: 1 },
          { position: 2, prospectId: dOmar, assigneeId: omar.id, day: 1 },
        ],
      },
    },
  });
  lotId = lot.id;
});

afterAll(async () => {
  await prisma.lotExport.deleteMany({ where: { id: lotId } });
  await prisma.prospect.deleteMany({
    where: { id: { in: [sienne, confiee, dOmar, convertie, relue] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [awa.id, omar.id, admin.id, clientele.id] } },
  });
  await prisma.$disconnect();
});

const nomsVusPar = async (user: AuthenticatedUser): Promise<string[]> => {
  const page = await prospects.list(user, { pageSize: 200, search: RUN });
  return page.items.map((row) => row.nom).toSorted();
};

describe('un téléconseiller voit ce que la campagne lui attribue', () => {
  it('voit ses propres fiches et celles qui lui sont attribuées', async () => {
    expect(await nomsVusPar(awa)).toEqual([`Confiee${RUN}`, `Sienne${RUN}`]);
  });

  it('ne voit pas la fiche attribuée à un collègue', async () => {
    expect(await nomsVusPar(awa)).not.toContain(`DOmar${RUN}`);
    expect(await nomsVusPar(omar)).toEqual([`DOmar${RUN}`]);
  });

  it('la file d’appel du web compte ce que la portée montre', async () => {
    const page = await prospects.list(awa, { pageSize: 200, search: RUN, phase2Status: 'PENDING' });

    expect(page.meta.total).toBe(2);
    expect(page.items.map((item) => item.id)).toContain(confiee);
  });

  it('ouvre en détail une fiche que la campagne lui a confiée', async () => {
    await expect(prospects.get(awa, confiee)).resolves.toMatchObject({ id: confiee });
  });

  it('refuse le détail d’une fiche qui ne lui est pas attribuée', async () => {
    await expect(prospects.get(awa, dOmar)).rejects.toMatchObject({
      response: { code: 'NOT_OWNER' },
    });
  });

  it('perd la fiche dès qu’elle est réattribuée', async () => {
    await prisma.lotExportItem.update({
      where: { lotId_position: { lotId, position: 1 } },
      data: { assigneeId: omar.id },
    });

    try {
      expect(await nomsVusPar(awa)).toEqual([`Sienne${RUN}`]);
      await expect(prospects.get(awa, confiee)).rejects.toMatchObject({
        response: { code: 'NOT_OWNER' },
      });
    } finally {
      await prisma.lotExportItem.update({
        where: { lotId_position: { lotId, position: 1 } },
        data: { assigneeId: awa.id },
      });
    }
  });

  it('l’ADMIN, lui, voit les trois fiches', async () => {
    expect(await nomsVusPar(admin)).toEqual([`Confiee${RUN}`, `DOmar${RUN}`, `Sienne${RUN}`]);
  });
});

describe('le chargé de clientèle isole les demandes qui restent à revoir', () => {
  const nomsAvec = async (revue?: boolean): Promise<string[]> => {
    const page = await prospects.list(clientele, {
      pageSize: 200,
      search: CLOSING,
      ...(revue === undefined ? {} : { revue }),
    });
    return page.items.map((row) => row.nom).toSorted();
  };

  it('sans le filtre, les deux demandes converties sont là', async () => {
    expect(await nomsAvec()).toEqual([`Convertie${CLOSING}`, `Relue${CLOSING}`]);
  });

  it('« non revue » ne rend que celle que personne n’a relue', async () => {
    expect(await nomsAvec(false)).toEqual([`Convertie${CLOSING}`]);
  });

  it('« revue » ne rend que celle qui porte une date de revue', async () => {
    expect(await nomsAvec(true)).toEqual([`Relue${CLOSING}`]);
  });

  it('la demande passe d’un filtre à l’autre dès qu’elle est revue', async () => {
    await prospects.marquerRevue(clientele, convertie);
    try {
      expect(await nomsAvec(false)).toEqual([]);
      expect(await nomsAvec(true)).toEqual([`Convertie${CLOSING}`, `Relue${CLOSING}`]);
    } finally {
      await prisma.prospect.update({
        where: { id: convertie },
        data: { revueAt: null, revueById: null },
      });
    }
  });
});
