process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';

import {
  CallOutcome,
  EnrollmentMethod,
  PrismaClient,
  PrismaPg,
  RepCallOutcome,
  Role,
  type Prisma,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { WorkShiftsService } from '../analytics/work-shifts.service.js';
import type { SupervisedUserDto } from './supervision.dto.js';
import { SupervisionService } from './supervision.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ROLLBACK = 'ROLLBACK_VOLONTAIRE';
const TAG = 'it-rendement';

const now = new Date();
const heure = (h: number, min = 0): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, min));

interface Decor {
  service: SupervisionService;
  awa: string;
  bineta: string;
  coumba: string;
}

async function teleconseiller(tx: Prisma.TransactionClient, nom: string): Promise<string> {
  const row = await tx.user.create({
    data: {
      id: uuidv7(),
      email: `${nom}.${TAG}@test.local`,
      username: `${nom}-${TAG}`,
      passwordHash: 'x',
      fullName: `${nom} ${TAG}`,
      role: Role.COMMERCIAL,
    },
    select: { id: true },
  });
  return row.id;
}

async function fiche(tx: Prisma.TransactionClient, createdById: string, rang: number) {
  const row = await tx.prospect.create({
    data: {
      id: uuidv7(),
      nom: `Rendement-${String(rang)}`,
      prenom: 'Test',
      phoneE164: `+2217709951${String(rang).padStart(2, '0')}`,
      createdById,
      clientCreatedAt: heure(7),
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * Awa : un appel hors créneau, un trou de vingt minutes DANS le matin, et une
 * fiche rappelée. Bineta : le même écart, mais à cheval sur la pause.
 */
async function semer(tx: Prisma.TransactionClient): Promise<Decor> {
  await tx.appSetting.deleteMany({ where: { key: 'supervision.creneaux' } });

  const awa = await teleconseiller(tx, 'awa');
  const bineta = await teleconseiller(tx, 'bineta');
  const coumba = await teleconseiller(tx, 'coumba');
  const [ficheA, ficheB, ficheC, ficheD, ficheE] = await Promise.all(
    [1, 2, 3, 4, 5].map((rang) => fiche(tx, awa, rang)),
  );

  const tentatives: [string, string, CallOutcome, number, number][] = [
    [awa, ficheE as string, CallOutcome.UNREACHABLE, 7, 30],
    [awa, ficheA as string, CallOutcome.METHOD_OBTAINED, 9, 0],
    [awa, ficheB as string, CallOutcome.UNREACHABLE, 9, 20],
    [awa, ficheB as string, CallOutcome.REFUSED, 9, 25],
    [bineta, ficheC as string, CallOutcome.REFUSED, 13, 50],
    [bineta, ficheD as string, CallOutcome.REFUSED, 15, 10],
    [coumba, ficheA as string, CallOutcome.REFUSED, 10, 0],
    [coumba, ficheC as string, CallOutcome.REFUSED, 10, 5],
  ];

  for (const [performedById, prospectId, outcome, h, min] of tentatives) {
    await tx.callAttempt.create({
      data: {
        id: uuidv7(),
        prospectId,
        performedById,
        outcome,
        // Contrainte CHECK : la méthode accompagne METHOD_OBTAINED, et elle seule.
        ...(outcome === CallOutcome.METHOD_OBTAINED ? { method: EnrollmentMethod.PLATFORM } : {}),
        clientCreatedAt: heure(h, min),
      },
    });
  }

  const departement = await tx.departement.findFirstOrThrow({ select: { id: true } });
  const representants: string[] = [];
  for (const rang of [1, 2]) {
    const row = await tx.representant.create({
      data: {
        id: uuidv7(),
        fullName: `Rendement Rep ${String(rang)} ${TAG}`,
        phoneE164: `+22177099519${String(rang)}`,
        departementId: departement.id,
        createdById: awa,
        clientCreatedAt: heure(7),
      },
      select: { id: true },
    });
    representants.push(row.id);
  }

  // Le premier finit sur REACHED, le second se dédit : seul le premier est qualifié.
  for (const [rang, outcome, min] of [
    [0, RepCallOutcome.REFUSED, 15],
    [0, RepCallOutcome.REACHED, 20],
    [1, RepCallOutcome.REACHED, 30],
    [1, RepCallOutcome.REFUSED, 35],
  ] as const) {
    await tx.repCallAttempt.create({
      data: {
        id: uuidv7(),
        representantId: representants[rang] as string,
        performedById: bineta,
        outcome,
        clientCreatedAt: heure(15, min),
      },
    });
  }

  const client = new Proxy(tx, {
    get: (cible, propriete, recepteur) => Reflect.get(cible, propriete, recepteur) as unknown,
  }) as unknown as PrismaService;

  return {
    service: new SupervisionService(client, new WorkShiftsService(client)),
    awa,
    bineta,
    coumba,
  };
}

async function surLeJeu<T>(run: (decor: Decor) => Promise<T>): Promise<T> {
  const boite: { valeur?: T } = {};

  const erreur = await prisma
    .$transaction(
      async (tx) => {
        boite.valeur = await run(await semer(tx));
        throw new Error(ROLLBACK);
      },
      { timeout: 60_000, maxWait: 20_000 },
    )
    .then(() => null)
    .catch((error: unknown) => (error as Error).message);

  if (erreur !== ROLLBACK) throw new Error(`jeu interrompu : ${String(erreur)}`);
  if (!('valeur' in boite)) throw new Error('aucun résultat');
  return boite.valeur;
}

afterAll(async () => {
  await prisma.$disconnect();
});

const lignes = async (): Promise<Record<string, SupervisedUserDto | undefined>> =>
  surLeJeu(async ({ service, awa, bineta, coumba }) => {
    const { teleconseillers } = await service.overview();
    return {
      awa: teleconseillers.find((row) => row.id === awa),
      bineta: teleconseillers.find((row) => row.id === bineta),
      coumba: teleconseillers.find((row) => row.id === coumba),
    };
  });

describe('le temps mort du jour', () => {
  it('compte le trou de vingt minutes tombé dans le créneau du matin', async () => {
    const { awa } = await lignes();

    expect(awa?.deadGaps).toBe(1);
    expect(awa?.deadSeconds).toBe(1200);
  });

  it('ne compte pas l’écart qui enjambe la pause, ni celui qui précède l’ouverture', async () => {
    const { bineta } = await lignes();

    expect(bineta?.deadGaps).toBe(0);
    expect(bineta?.deadSeconds).toBe(0);
  });
});

describe('les fiches rappelées', () => {
  it('compte les appels au-delà du premier sur une même fiche', async () => {
    const { awa } = await lignes();

    expect(awa?.callsToday).toBe(4);
    expect(awa?.repeatCalls).toBe(1);
  });

  it('compte aussi un représentant rappelé, séparément des fiches prospects', async () => {
    const { bineta } = await lignes();

    expect(bineta?.callsToday).toBe(6);
    expect(bineta?.repeatCalls).toBe(2);
  });

  it('reste à zéro quand chaque fiche n’a été appelée qu’une fois', async () => {
    const { coumba } = await lignes();

    expect(coumba?.callsToday).toBe(2);
    expect(coumba?.repeatCalls).toBe(0);
    expect(coumba?.deadGaps).toBe(0);
  });
});

describe('joints et qualifiés, dans le vocabulaire de l’écran d’activité', () => {
  it('un numéro injoignable n’est pas joint, la méthode obtenue qualifie', async () => {
    const { awa } = await lignes();

    expect(awa?.reachedToday).toBe(2);
    expect(awa?.qualifiedToday).toBe(1);
    expect(awa?.firstCallAt).toBe(heure(7, 30).toISOString());
    expect(awa?.lastCallAt).toBe(heure(9, 25).toISOString());
  });

  it('un représentant appelé deux fois compte sur sa DERNIÈRE réponse', async () => {
    const { bineta } = await lignes();

    // Deux prospects joignables et quatre réponses de représentants ; mais le
    // représentant qui s'est dédit après un REACHED n'est plus qualifié.
    expect(bineta?.reachedToday).toBe(6);
    expect(bineta?.qualifiedToday).toBe(1);
  });
});
