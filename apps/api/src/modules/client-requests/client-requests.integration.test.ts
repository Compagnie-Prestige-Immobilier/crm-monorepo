process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import { ClientRequestStatus, PrismaClient, PrismaPg, Role } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TAG = 'ITCR';

const PHONE_A = '+221770990001';
const PHONE_B = '+221770990002';

let banqueId: string;
let syndicatId: string;
let departementId: string;
let requesterId: string;
let adminId: string;
let representantId: string;

async function cleanup(): Promise<void> {
  await prisma.clientCreationRequest.deleteMany({ where: { nom: { startsWith: TAG } } });
  await prisma.prospect.deleteMany({ where: { phoneE164: { in: [PHONE_A, PHONE_B] } } });
  await prisma.prospect.deleteMany({ where: { nom: { startsWith: TAG } } });
}

async function cleanupAll(): Promise<void> {
  await cleanup();
  await prisma.representant.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG.toLowerCase() } } });
}

beforeAll(async () => {
  await cleanupAll();

  const banque = await prisma.banque.findFirstOrThrow({ select: { id: true } });
  const syndicat = await prisma.syndicat.findFirstOrThrow({ select: { id: true } });
  const departement = await prisma.departement.findFirstOrThrow({ select: { id: true } });
  banqueId = banque.id;
  syndicatId = syndicat.id;
  departementId = departement.id;

  const [requester, admin] = await Promise.all([
    prisma.user.create({
      data: {
        id: uuidv7(),
        username: `${TAG.toLowerCase()}-banque`,
        email: `${TAG.toLowerCase()}-banque@cpi.sn`,
        fullName: `${TAG} Agent Banque`,
        passwordHash: 'x',
        role: Role.BANQUE_FINANCE,
      },
      select: { id: true },
    }),
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
  ]);
  requesterId = requester.id;
  adminId = admin.id;

  const representant = await prisma.representant.create({
    data: {
      id: uuidv7(),
      fullName: `${TAG} Représentant`,
      phoneE164: '+221770990099',
      departementId,
      createdById: adminId,
      clientCreatedAt: new Date('2026-01-05T09:00:00.000Z'),
    },
    select: { id: true },
  });
  representantId = representant.id;
});

afterAll(async () => {
  await cleanupAll();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanup();
});

const depose = async (
  phone: string,
  status: ClientRequestStatus = ClientRequestStatus.PENDING,
): Promise<string> => {
  const row = await prisma.clientCreationRequest.create({
    data: {
      id: uuidv7(),
      nom: `${TAG}-Ndiaye`,
      prenom: 'Fatou',
      phoneE164: phone,
      banqueId,
      requestedById: requesterId,
      status,
      ...(status === ClientRequestStatus.REJECTED ? { rejectionNote: 'Doublon' } : {}),
    },
    select: { id: true },
  });
  return row.id;
};

const donneesProspect = (id: string, phone: string): Record<string, unknown> => ({
  id,
  nom: `${TAG}-Ndiaye`,
  prenom: 'Fatou',
  phoneE164: phone,
  banqueId,
  syndicatId,
  representantId,
  createdById: adminId,
  origin: 'BANQUE',
  clientCreatedAt: new Date('2026-02-10T08:00:00.000Z'),
});

describe('approbation : la transaction est TOUT OU RIEN', () => {
  it('une revendication perdue ne laisse AUCUN prospect orphelin', async () => {
    const requestId = await depose(PHONE_A);
    const prospectId = uuidv7();

    const perdu = await prisma
      .$transaction(async (tx) => {
        await tx.prospect.create({ data: donneesProspect(prospectId, PHONE_A) as never });

        await prisma.clientCreationRequest.updateMany({
          where: { id: requestId, status: ClientRequestStatus.PENDING },
          data: {
            status: ClientRequestStatus.REJECTED,
            reviewedById: adminId,
            reviewedAt: new Date(),
            rejectionNote: 'Arbitré ailleurs',
          },
        });

        const claimed = await tx.clientCreationRequest.updateMany({
          where: { id: requestId, status: ClientRequestStatus.PENDING },
          data: {
            status: ClientRequestStatus.APPROVED,
            reviewedById: adminId,
            reviewedAt: new Date(),
            createdProspectId: prospectId,
          },
        });
        if (claimed.count === 0) throw new Error('CLIENT_REQUEST_ALREADY_REVIEWED');
        return 'gagné';
      })
      .catch((error: unknown) => (error as Error).message);

    expect(perdu).toBe('CLIENT_REQUEST_ALREADY_REVIEWED');

    expect(await prisma.prospect.findUnique({ where: { id: prospectId } })).toBeNull();
    expect(await prisma.prospect.count({ where: { phoneE164: PHONE_A } })).toBe(0);

    const apres = await prisma.clientCreationRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { status: true, createdProspectId: true },
    });
    expect(apres.status).toBe(ClientRequestStatus.REJECTED);
    expect(apres.createdProspectId).toBeNull();
  });

  it('l’approbation qui aboutit laisse la demande ET son prospect', async () => {
    const requestId = await depose(PHONE_B);
    const prospectId = uuidv7();

    await prisma.$transaction(async (tx) => {
      await tx.prospect.create({ data: donneesProspect(prospectId, PHONE_B) as never });
      const claimed = await tx.clientCreationRequest.updateMany({
        where: { id: requestId, status: ClientRequestStatus.PENDING },
        data: {
          status: ClientRequestStatus.APPROVED,
          reviewedById: adminId,
          reviewedAt: new Date(),
          createdProspectId: prospectId,
        },
      });
      expect(claimed.count).toBe(1);
    });

    expect(await prisma.prospect.count({ where: { id: prospectId } })).toBe(1);
    const apres = await prisma.clientCreationRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { status: true, createdProspectId: true },
    });
    expect(apres).toEqual({
      status: ClientRequestStatus.APPROVED,
      createdProspectId: prospectId,
    });
  });
});

describe('contrainte client_creation_requests_approved_has_prospect', () => {
  it('REFUSE une demande approuvée sans prospect', async () => {
    const requestId = await depose(PHONE_A);

    const erreur =
      await prisma.$executeRaw`UPDATE "client_creation_requests" SET "status" = 'APPROVED' WHERE "id" = ${requestId}`
        .then(() => null)
        .catch((error: unknown) => (error as Error).message);

    expect(erreur).not.toBeNull();
    expect(erreur).toContain('client_creation_requests_approved_has_prospect');

    const apres = await prisma.clientCreationRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { status: true },
    });
    expect(apres.status).toBe(ClientRequestStatus.PENDING);
  });

  it('REFUSE une demande refusée sans motif', async () => {
    const requestId = await depose(PHONE_A);

    const erreur =
      await prisma.$executeRaw`UPDATE "client_creation_requests" SET "status" = 'REJECTED' WHERE "id" = ${requestId}`
        .then(() => null)
        .catch((error: unknown) => (error as Error).message);

    expect(erreur).toContain('client_creation_requests_rejected_has_note');
  });

  it('ACCEPTE une demande approuvée qui porte son prospect', async () => {
    const requestId = await depose(PHONE_A);
    const prospectId = uuidv7();
    await prisma.prospect.create({ data: donneesProspect(prospectId, PHONE_A) as never });

    await prisma.clientCreationRequest.update({
      where: { id: requestId },
      data: {
        status: ClientRequestStatus.APPROVED,
        createdProspectId: prospectId,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    const apres = await prisma.clientCreationRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { status: true },
    });
    expect(apres.status).toBe(ClientRequestStatus.APPROVED);
  });
});

describe('index client_creation_requests_pending_phone_key', () => {
  it('REFUSE un second dépôt EN ATTENTE sur le même numéro', async () => {
    await depose(PHONE_A);

    const erreur = await depose(PHONE_A)
      .then(() => null)
      .catch((error: unknown) => (error as { code?: string }).code ?? String(error));

    expect(erreur).toBe('P2002');
    expect(
      await prisma.clientCreationRequest.count({
        where: { phoneE164: PHONE_A, status: ClientRequestStatus.PENDING },
      }),
    ).toBe(1);
  });

  it('AUTORISE un nouveau dépôt après un refus sur le même numéro', async () => {
    const premier = await depose(PHONE_A, ClientRequestStatus.REJECTED);

    const second = await depose(PHONE_A);

    expect(second).not.toBe(premier);
    expect(await prisma.clientCreationRequest.count({ where: { phoneE164: PHONE_A } })).toBe(2);
    expect(
      await prisma.clientCreationRequest.count({
        where: { phoneE164: PHONE_A, status: ClientRequestStatus.PENDING },
      }),
    ).toBe(1);
  });

  it('AUTORISE deux demandes EN ATTENTE sur deux numéros différents', async () => {
    await depose(PHONE_A);
    await depose(PHONE_B);

    expect(
      await prisma.clientCreationRequest.count({
        where: { status: ClientRequestStatus.PENDING, nom: { startsWith: TAG } },
      }),
    ).toBe(2);
  });
});
