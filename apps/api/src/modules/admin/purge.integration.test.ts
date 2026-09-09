process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import {
  ClientRequestStatus,
  PrismaClient,
  PrismaPg,
  RepCallOutcome,
  Role,
  type Prisma,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PURGE_DOMAIN_KEYS, type PurgeDomainKey } from './purge-plan.js';
import { PurgeService } from './purge.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TAG = 'ITPG';

const ROLLBACK = 'ROLLBACK_VOLONTAIRE';

let firstAdmin: { id: string; username: string; email: string };
let actor: AuthenticatedUser;

async function dansUneTransactionAnnulee<T>(
  run: (service: PurgeService, tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const boite: { valeur?: T } = {};

  const erreur = await prisma
    .$transaction(
      async (tx) => {
        const mandataire = new Proxy(tx, {
          get(cible, propriete, recepteur) {
            if (propriete === '$transaction') {
              return (rappel: (inner: Prisma.TransactionClient) => Promise<unknown>) => rappel(tx);
            }
            return Reflect.get(cible, propriete, recepteur) as unknown;
          },
        }) as unknown as PrismaService;

        boite.valeur = await run(new PurgeService(mandataire), tx);
        throw new Error(ROLLBACK);
      },
      { timeout: 60_000 },
    )
    .then(() => null)
    .catch((error: unknown) => (error as Error).message);

  if (erreur !== ROLLBACK) throw new Error(`purge interrompue : ${String(erreur)}`);
  if (!('valeur' in boite)) throw new Error('la purge n’a rien rendu');
  return boite.valeur;
}

async function semer(tx: Prisma.TransactionClient): Promise<void> {
  const departement = await tx.departement.findFirstOrThrow({ select: { id: true } });
  const ief = await tx.ief.findFirstOrThrow({ select: { id: true } });
  const banque = await tx.banque.findFirstOrThrow({ select: { id: true } });
  const syndicat = await tx.syndicat.findFirstOrThrow({ select: { id: true } });

  const commercial = await tx.user.create({
    data: {
      id: uuidv7(),
      username: `${TAG.toLowerCase()}-com`,
      email: `${TAG.toLowerCase()}-com@cpi.sn`,
      fullName: `${TAG} Commercial`,
      passwordHash: 'x',
      role: Role.COMMERCIAL,
      departementId: departement.id,
    },
    select: { id: true },
  });

  const banquier = await tx.user.create({
    data: {
      id: uuidv7(),
      username: `${TAG.toLowerCase()}-bq`,
      email: `${TAG.toLowerCase()}-bq@cpi.sn`,
      fullName: `${TAG} Banque`,
      passwordHash: 'x',
      role: Role.BANQUE_FINANCE,
    },
    select: { id: true },
  });

  const representant = await tx.representant.create({
    data: {
      id: uuidv7(),
      fullName: `${TAG} Représentant`,
      phoneE164: '+221770991001',
      departementId: departement.id,
      iefId: ief.id,
      createdById: commercial.id,
      clientCreatedAt: new Date('2026-01-02T09:00:00.000Z'),
    },
    select: { id: true },
  });

  const prospect = await tx.prospect.create({
    data: {
      id: uuidv7(),
      nom: `${TAG}-Diallo`,
      prenom: 'Awa',
      phoneE164: '+221770991002',
      banqueId: banque.id,
      syndicatId: syndicat.id,
      representantId: representant.id,
      createdById: commercial.id,
      clientCreatedAt: new Date('2026-01-03T09:00:00.000Z'),
    },
    select: { id: true },
  });

  await tx.repCallAttempt.create({
    data: {
      id: uuidv7(),
      representantId: representant.id,
      performedById: commercial.id,
      outcome: RepCallOutcome.CALLBACK,
      clientCreatedAt: new Date('2026-01-04T09:00:00.000Z'),
    },
  });

  await tx.clientCreationRequest.create({
    data: {
      id: uuidv7(),
      nom: `${TAG}-Sow`,
      prenom: 'Moussa',
      phoneE164: '+221770991003',
      banqueId: banque.id,
      requestedById: banquier.id,
      reviewedById: firstAdmin.id,
      reviewedAt: new Date(),
      status: ClientRequestStatus.APPROVED,
      createdProspectId: prospect.id,
    },
  });

  await tx.clientCreationRequest.create({
    data: {
      id: uuidv7(),
      nom: `${TAG}-Ba`,
      prenom: 'Ndeye',
      phoneE164: '+221770991004',
      banqueId: banque.id,
      requestedById: banquier.id,
      status: ClientRequestStatus.PENDING,
    },
  });
}

beforeAll(async () => {
  const admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN, deletedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, username: true, email: true },
  });
  if (!admin) throw new Error('aucun administrateur : lancer pnpm db:seed');
  firstAdmin = admin;
  actor = {
    id: admin.id,
    email: admin.email,
    username: admin.username,
    fullName: admin.username,
    role: Role.ADMIN,
  };
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('purge complète sur une base qui utilise TOUTES les tables', () => {
  it('va jusqu’au bout avec les tables métier conservées', async () => {
    const resultat = await dansUneTransactionAnnulee(async (service, tx) => {
      await semer(tx);
      return service.purge(actor, {
        domains: [...PURGE_DOMAIN_KEYS] as PurgeDomainKey[],
        confirmation: firstAdmin.username,
      });
    });

    expect(resultat.total).toBeGreaterThan(0);
    expect(resultat.deleted.length).toBeGreaterThan(0);
    expect(new Date(resultat.purgedAt).getTime()).toBeGreaterThan(0);
  });

  it('le domaine des téléconseillers emporte ses dépendances sans avorter', async () => {
    const resultat = await dansUneTransactionAnnulee(async (service, tx) => {
      await semer(tx);
      return service.purge(actor, {
        domains: ['teleconseillers'],
        confirmation: firstAdmin.email,
      });
    });

    const parDomaine = new Map(resultat.deleted.map((row) => [row.key, row.rows]));
    expect(parDomaine.has('referentiels')).toBe(false);
    expect(resultat.total).toBeGreaterThan(0);
  });

  it('le catalogue annonce ce que la purge supprime réellement', async () => {
    const { annonce, supprime } = await dansUneTransactionAnnulee(async (service, tx) => {
      await semer(tx);
      const catalogue = await service.catalog(actor);
      const resultat = await service.purge(actor, {
        domains: [...PURGE_DOMAIN_KEYS] as PurgeDomainKey[],
        confirmation: firstAdmin.username,
      });
      return {
        annonce: catalogue.domains.reduce((somme, domaine) => somme + domaine.rows, 0),
        supprime: resultat.total,
      };
    });

    expect(supprime).toBe(annonce);
  });

  it('refuse une confirmation qui ne correspond pas, sans rien supprimer', async () => {
    const code = await dansUneTransactionAnnulee(async (service, tx) => {
      await semer(tx);
      const erreur = await service
        .purge(actor, {
          domains: [...PURGE_DOMAIN_KEYS] as PurgeDomainKey[],
          confirmation: 'quelqu-un-d-autre',
        })
        .then(() => null)
        .catch((caught: unknown) => (caught as { response?: { code?: string } }).response?.code);

      expect(
        await tx.representant.count({
          where: { fullName: { startsWith: TAG } },
        }),
      ).toBe(1);
      return erreur;
    });

    expect(code).toBe('PURGE_CONFIRMATION_MISMATCH');
  });
});
