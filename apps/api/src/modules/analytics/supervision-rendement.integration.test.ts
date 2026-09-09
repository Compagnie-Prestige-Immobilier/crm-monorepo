process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

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
import type { SupervisionScoreDto } from './supervision.dto.js';
import { SupervisionActivityService } from './supervision.service.js';
import { WorkShiftsService } from './work-shifts.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ROLLBACK = 'ROLLBACK_VOLONTAIRE';
const TAG = 'it-rendement-fenetre';

/** Une fenêtre passée : chaque journée vue compte alors ses créneaux ENTIERS. */
const FENETRE = { actFrom: '2026-03-01', actTo: '2026-03-31' };
const LUNDI = '2026-03-02';
const MARDI = '2026-03-03';

/** Créneaux par défaut : 09:00-14:00 et 15:00-18:00, soit 28 800 s par jour. */
const JOURNEE = 28_800;
const MATIN = 18_000;

const a = (jour: string, h: number, min = 0): Date =>
  new Date(`${jour}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00.000Z`);

interface Decor {
  service: SupervisionActivityService;
  awa: string;
  bineta: string;
  coumba: string;
  daba: string;
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

async function fiche(
  tx: Prisma.TransactionClient,
  createdById: string,
  rang: number,
): Promise<string> {
  const row = await tx.prospect.create({
    data: {
      id: uuidv7(),
      nom: `Fenetre-${String(rang)}`,
      prenom: 'Test',
      phoneE164: `+2217709961${String(rang).padStart(2, '0')}`,
      createdById,
      clientCreatedAt: a(LUNDI, 8),
    },
    select: { id: true },
  });
  return row.id;
}

async function tranche(
  tx: Prisma.TransactionClient,
  userId: string,
  jour: string,
  heure: number,
  activeSeconds: number,
): Promise<void> {
  await tx.agentActivitySlot.create({
    data: {
      userId,
      slot: a(jour, heure),
      firstSeenAt: a(jour, heure),
      lastSeenAt: a(jour, heure, 59),
      activeSeconds,
    },
  });
}

/**
 * Awa appelle un seul jour : un trou de vingt minutes dans le matin, puis une
 * reprise l'après-midi par-dessus la pause. Bineta ferme un jour et rouvre le
 * lendemain, DANS le même créneau. Coumba est présente sans passer un appel.
 * Daba appelle le même représentant à deux jours d'écart.
 */
async function semer(tx: Prisma.TransactionClient): Promise<Decor> {
  await tx.appSetting.deleteMany({ where: { key: 'supervision.creneaux' } });

  const awa = await teleconseiller(tx, 'awa');
  const bineta = await teleconseiller(tx, 'bineta');
  const coumba = await teleconseiller(tx, 'coumba');
  const daba = await teleconseiller(tx, 'daba');

  const [ficheA, ficheB, ficheC, ficheD] = await Promise.all(
    [1, 2, 3, 4].map((rang) => fiche(tx, awa, rang)),
  );

  // Dernière colonne : appel retrouvé dans le journal du téléphone Android.
  const tentatives: [string, string, CallOutcome, string, number, number, boolean][] = [
    [awa, ficheA as string, CallOutcome.METHOD_OBTAINED, LUNDI, 9, 0, true],
    [awa, ficheB as string, CallOutcome.UNREACHABLE, LUNDI, 9, 20, true],
    [awa, ficheB as string, CallOutcome.REFUSED, LUNDI, 9, 25, false],
    [awa, ficheC as string, CallOutcome.REFUSED, LUNDI, 15, 30, false],
    [bineta, ficheC as string, CallOutcome.REFUSED, LUNDI, 13, 50, false],
    [bineta, ficheD as string, CallOutcome.REFUSED, MARDI, 9, 0, false],
  ];

  for (const [performedById, prospectId, outcome, jour, h, min, confirme] of tentatives) {
    await tx.callAttempt.create({
      data: {
        id: uuidv7(),
        prospectId,
        performedById,
        outcome,
        ...(outcome === CallOutcome.METHOD_OBTAINED ? { method: EnrollmentMethod.PLATFORM } : {}),
        ...(confirme
          ? {
              deviceCallType: 'sortant',
              deviceCallDurationSeconds: 92,
              deviceCallAt: a(jour, h, min),
            }
          : {}),
        clientCreatedAt: a(jour, h, min),
      },
    });
  }

  const departement = await tx.departement.findFirstOrThrow({ select: { id: true } });
  const representant = await tx.representant.create({
    data: {
      id: uuidv7(),
      fullName: `Fenetre Rep ${TAG}`,
      phoneE164: '+221770996199',
      departementId: departement.id,
      createdById: daba,
      clientCreatedAt: a(LUNDI, 8),
    },
    select: { id: true },
  });

  // Un oui lundi, un non mardi : sur la fenêtre, c'est le non qui vaut.
  for (const [outcome, jour] of [
    [RepCallOutcome.REACHED, LUNDI],
    [RepCallOutcome.REFUSED, MARDI],
  ] as const) {
    await tx.repCallAttempt.create({
      data: {
        id: uuidv7(),
        representantId: representant.id,
        performedById: daba,
        outcome,
        ...(outcome === RepCallOutcome.REACHED
          ? { deviceCallType: 'sortant', deviceCallDurationSeconds: 92, deviceCallAt: a(jour, 9) }
          : {}),
        clientCreatedAt: a(jour, 9),
      },
    });
  }

  await tranche(tx, awa, LUNDI, 9, 3000);
  await tranche(tx, awa, LUNDI, 15, 1200);
  await tranche(tx, coumba, LUNDI, 7, 3600);
  await tranche(tx, coumba, LUNDI, 10, 1800);

  const client = new Proxy(tx, {
    get: (cible, propriete, recepteur) => Reflect.get(cible, propriete, recepteur) as unknown,
  }) as unknown as PrismaService;

  return {
    service: new SupervisionActivityService(client, new WorkShiftsService(client)),
    awa,
    bineta,
    coumba,
    daba,
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

const notes = async (
  filtre: Record<string, string> = {},
): Promise<Record<string, SupervisionScoreDto | undefined>> =>
  surLeJeu(async ({ service, awa, bineta, coumba, daba }) => {
    const { scores } = await service.activite({ ...FENETRE, ...filtre });
    const de = (id: string) => scores.find((ligne) => ligne.teleconseillerId === id);
    return { awa: de(awa), bineta: de(bineta), coumba: de(coumba), daba: de(daba) };
  });

describe('le temps mort sur la fenêtre', () => {
  it('compte le trou de vingt minutes tombé dans le créneau du matin', async () => {
    const { awa } = await notes();

    expect(awa?.calls).toBe(4);
    expect(awa?.deadSeconds).toBe(1200);
  });

  it('ne compte pas l’écart qui enjambe une nuit, même dans le même créneau', async () => {
    const { bineta, daba } = await notes();

    expect(bineta?.calls).toBe(2);
    expect(bineta?.deadSeconds).toBe(0);
    expect(daba?.deadSeconds).toBe(0);
  });
});

describe('les entrées reprises de l’écran d’activité', () => {
  it('un injoignable n’est pas joint, la méthode obtenue qualifie, la fiche rappelée compte', async () => {
    const { awa } = await notes();

    expect(awa?.reached).toBe(3);
    expect(awa?.qualified).toBe(1);
    expect(awa?.repeatCalls).toBe(1);
  });

  it('les appels aux représentants entrent dans la note, sur leur DERNIÈRE réponse', async () => {
    const { daba } = await notes();

    expect(daba?.calls).toBe(2);
    expect(daba?.reached).toBe(2);
    expect(daba?.qualified).toBe(0);
    expect(daba?.repeatCalls).toBe(1);
  });

  it('la présence hors créneau reste dehors', async () => {
    const { awa, coumba } = await notes();

    expect(awa?.activeSecondsInShifts).toBe(4200);
    expect(coumba?.activeSecondsInShifts).toBe(1800);
  });
});

describe('le dénominateur ne compte que les jours vus', () => {
  it('un jour d’appels pour Awa, deux pour Bineta', async () => {
    const { awa, bineta } = await notes();

    expect(awa?.shiftSecondsElapsed).toBe(JOURNEE);
    expect(bineta?.shiftSecondsElapsed).toBe(2 * JOURNEE);
  });

  it('une tranche de présence suffit à faire compter la journée', async () => {
    const { coumba } = await notes();

    expect(coumba?.shiftSecondsElapsed).toBe(JOURNEE);
  });

  it('le filtre horaire rabote les créneaux, sinon la matinée serait divisée par la journée', async () => {
    const { awa } = await notes({ timeFrom: '09:00', timeTo: '14:00' });

    expect(awa?.shiftSecondsElapsed).toBe(MATIN);
    expect(awa?.activeSecondsInShifts).toBe(3000);
  });
});

describe('quand rien ne peut être jugé', () => {
  it('présente sans un seul appel : un motif, pas un zéro', async () => {
    const { coumba } = await notes();

    expect(coumba?.calls).toBe(0);
    expect(coumba?.score.value).toBeNull();
    expect(coumba?.score.reason).toBe('aucun_appel');
    expect(coumba?.score.parts).toEqual([]);
  });

  it('hors fenêtre, personne n’est vu : le motif change, la note reste absente', async () => {
    const { awa, coumba } = await notes({ actFrom: '2026-04-01', actTo: '2026-04-30' });

    expect(awa?.shiftSecondsElapsed).toBe(0);
    expect(awa?.score.reason).toBe('journee_non_commencee');
    expect(coumba?.score.value).toBeNull();
  });

  it('Awa reste notée, sur ses parts', async () => {
    const { awa } = await notes();

    expect(awa?.score.value).toBeGreaterThan(0);
    expect(awa?.score.reason).toBeNull();
    expect(awa?.score.parts).toHaveLength(6);
  });
});

describe('appels confirmés par le journal du téléphone', () => {
  it('ne compte que les tentatives horodatées par le téléphone', async () => {
    const [prospects, representants] = await surLeJeu(async ({ service, awa, daba }) =>
      Promise.all([
        service.activite({ ...FENETRE, commercialId: awa }),
        service.activite({ ...FENETRE, commercialId: daba }),
      ]),
    );

    expect(prospects.totals.calls).toBe(4);
    expect(prospects.totals.confirmedCalls).toBe(2);
    expect(representants.totals.repCalls).toBe(2);
    expect(representants.totals.repConfirmedCalls).toBe(1);
  });
});
