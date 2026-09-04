process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import {
  CallOutcome,
  PrismaClient,
  PrismaPg,
  RepCallOutcome,
  Role,
  ScheduledCallbackStatus,
  type Prisma,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { SupervisionActivityCountsDto } from './supervision.dto.js';
import { SupervisionActivityService } from './supervision.service.js';
import { WorkShiftsService } from './work-shifts.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ROLLBACK = 'ROLLBACK_VOLONTAIRE';
const TAG = 'it-appels-detectes';
const FENETRE = { actFrom: '2026-04-01', actTo: '2026-04-30' };
const JOUR = '2026-04-06';

/** Loin devant la fenêtre : un rappel posé là est encore à venir, pas en retard. */
const PLUS_TARD = '2027-04-06';

const a = (jour: string, h: number, min = 0): Date =>
  new Date(`${jour}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00.000Z`);

interface Decor {
  service: SupervisionActivityService;
  userId: string;
}

async function semer(tx: Prisma.TransactionClient): Promise<Decor> {
  const user = await tx.user.create({
    data: {
      id: uuidv7(),
      email: `awa.${TAG}@test.local`,
      username: `awa-${TAG}`,
      passwordHash: 'x',
      fullName: `Awa ${TAG}`,
      role: Role.COMMERCIAL,
    },
    select: { id: true },
  });

  const prospect = await tx.prospect.create({
    data: {
      id: uuidv7(),
      nom: 'Detecte',
      prenom: 'Test',
      phoneE164: '+221770997001',
      createdById: user.id,
      clientCreatedAt: a(JOUR, 8),
    },
    select: { id: true },
  });

  const departement = await tx.departement.findFirstOrThrow({ select: { id: true } });
  const representant = await tx.representant.create({
    data: {
      id: uuidv7(),
      fullName: `Rep ${TAG}`,
      phoneE164: '+221770997002',
      departementId: departement.id,
      createdById: user.id,
      clientCreatedAt: a(JOUR, 8),
    },
    select: { id: true },
  });

  // Deux appels prospects confirmés, 60 s et 120 s : moyenne 90 s.
  const tentatives: string[] = [];
  for (const [min, duree] of [
    [0, 60],
    [30, 120],
  ] as const) {
    const row = await tx.callAttempt.create({
      data: {
        id: uuidv7(),
        prospectId: prospect.id,
        performedById: user.id,
        outcome: CallOutcome.REFUSED,
        deviceCallType: 'sortant',
        deviceCallDurationSeconds: duree,
        deviceCallAt: a(JOUR, 9, min),
        clientCreatedAt: a(JOUR, 9, min),
      },
      select: { id: true },
    });
    tentatives.push(row.id);
  }

  await tx.repCallAttempt.create({
    data: {
      id: uuidv7(),
      representantId: representant.id,
      performedById: user.id,
      outcome: RepCallOutcome.REACHED,
      deviceCallType: 'sortant',
      deviceCallDurationSeconds: 200,
      deviceCallAt: a(JOUR, 10),
      clientCreatedAt: a(JOUR, 10),
    },
  });

  // Trois détections prospects : un entrant DÉJÀ consigné, deux orphelines dont
  // un entrant et un manqué. Une détection représentant, orpheline.
  const detections: [string | null, string | null, string, string | null][] = [
    [prospect.id, null, 'entrant', tentatives[0] ?? null],
    [prospect.id, null, 'entrant', null],
    [prospect.id, null, 'manque', null],
    [null, representant.id, 'sortant', null],
  ];
  for (const [prospectId, representantId, type, lien] of detections) {
    await tx.deviceCallDetection.create({
      data: {
        id: uuidv7(),
        performedById: user.id,
        prospectId,
        representantId,
        deviceCallType: type,
        deviceCallDurationSeconds: 30,
        deviceCallAt: a(JOUR, 11),
        detectedAt: a(JOUR, 11, 1),
        attemptId: lien,
      },
    });
  }

  // Rappels prospects : un tenu, un en retard, un encore à venir. Un index
  // partiel n'autorise qu'un rappel en attente par fiche, d'où une fiche par
  // rappel.
  const rappels: [Date, ScheduledCallbackStatus, number][] = [
    [a(JOUR, 12), ScheduledCallbackStatus.DONE, 11],
    [a(JOUR, 13), ScheduledCallbackStatus.PENDING, 12],
    [a(PLUS_TARD, 12), ScheduledCallbackStatus.PENDING, 13],
  ];
  for (const [scheduledAt, status, rang] of rappels) {
    const fiche = await tx.prospect.create({
      data: {
        id: uuidv7(),
        nom: `Rappel-${String(rang)}`,
        prenom: 'Test',
        phoneE164: `+2217709970${String(rang)}`,
        createdById: user.id,
        clientCreatedAt: a(JOUR, 8),
      },
      select: { id: true },
    });
    await tx.scheduledCallback.create({
      data: {
        prospectId: fiche.id,
        assignedToId: user.id,
        scheduledAt,
        status,
        sourceAttemptId: uuidv7(),
      },
    });
  }

  const client = new Proxy(tx, {
    get: (cible, propriete, recepteur) => Reflect.get(cible, propriete, recepteur) as unknown,
  }) as unknown as PrismaService;

  return {
    service: new SupervisionActivityService(client, new WorkShiftsService(client)),
    userId: user.id,
  };
}

async function chiffres(
  filtre: Record<string, string> = {},
): Promise<SupervisionActivityCountsDto> {
  const boite: { valeur?: SupervisionActivityCountsDto } = {};

  const erreur = await prisma
    .$transaction(
      async (tx) => {
        const { service, userId } = await semer(tx);
        // La base de développement porte le travail d'autres comptes : sans
        // borner sur celui qu'on vient de semer, les totaux les ramassent.
        boite.valeur = (
          await service.activite({
            actFrom: FENETRE.actFrom,
            actTo: '2027-12-31',
            commercialId: userId,
            ...filtre,
          })
        ).totals;
        throw new Error(ROLLBACK);
      },
      { timeout: 60_000, maxWait: 20_000 },
    )
    .then(() => null)
    .catch((error: unknown) => (error as Error).message);

  if (erreur !== ROLLBACK) throw new Error(`jeu interrompu : ${String(erreur)}`);
  if (!('valeur' in boite)) throw new Error('aucun résultat');
  return boite.valeur as SupervisionActivityCountsDto;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('appels vus par le téléphone', () => {
  it('compte les détections par famille, et celles que rien ne consigne', async () => {
    const totals = await chiffres();

    expect(totals.detectedCalls).toBe(3);
    expect(totals.unloggedCalls).toBe(2);
    expect(totals.repDetectedCalls).toBe(1);
    expect(totals.repUnloggedCalls).toBe(1);
  });

  it('sépare l’entrant du manqué, sans recompter une détection consignée', async () => {
    const totals = await chiffres();

    expect(totals.inboundCalls).toBe(1);
    expect(totals.missedCalls).toBe(1);
  });
});

describe('durée moyenne d’un appel confirmé', () => {
  it('moyenne les durées du journal, famille par famille', async () => {
    const totals = await chiffres();

    expect(totals.avgCallSeconds).toBe(90);
    expect(totals.repAvgCallSeconds).toBe(200);
  });
});

describe('sort des rappels promis', () => {
  it('sépare le tenu, le retard et l’à-venir', async () => {
    const totals = await chiffres();

    expect(totals.callbacksHonored).toBe(1);
    expect(totals.callbacksLate).toBe(1);
    expect(totals.callbacksUpcoming).toBe(1);
  });
});
