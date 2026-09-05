process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import {
  LotExportCible,
  PrismaClient,
  PrismaPg,
  Projet,
  RepCallOutcome,
  Role,
  type Prisma,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { CampagnesService } from './campagnes.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ROLLBACK = 'ROLLBACK_VOLONTAIRE';
const TAG = 'it-campagnes';
const FENETRE = { actFrom: '2026-03-01', actTo: '2026-03-31' };
const a = (jour: string, h: number): Date =>
  new Date(`${jour}T${String(h).padStart(2, '0')}:00:00.000Z`);

interface Decor {
  service: CampagnesService;
  awa: string;
  bineta: string;
  lotId: string;
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

/**
 * Un lot de quatre représentants créé le 2 mars : trois pour Awa sur le jour 1,
 * un pour Bineta sur le jour 2. Awa appelle deux fiches, dont une trois fois,
 * et pose un statut sur une seule ; Bineta n'appelle pas. Un appel d'AVANT le
 * lot ne compte pas.
 */
async function semer(tx: Prisma.TransactionClient): Promise<Decor> {
  const departement = await tx.departement.findFirstOrThrow({ select: { id: true } });
  const awa = await teleconseiller(tx, 'awa');
  const bineta = await teleconseiller(tx, 'bineta');
  const statut = await tx.statutQualification.findUniqueOrThrow({
    where: { code: 'ACCEPTE' },
    select: { id: true },
  });

  const reps: string[] = [];
  for (const rang of [1, 2, 3, 4]) {
    const row = await tx.representant.create({
      data: {
        id: uuidv7(),
        fullName: `Campagne Rep ${String(rang)}`,
        phoneE164: `+22177099430${String(rang)}`,
        departementId: departement.id,
        createdById: awa,
        clientCreatedAt: a('2026-03-01', 8),
      },
      select: { id: true },
    });
    reps.push(row.id);
  }
  const [rep1, rep2, rep3, rep4] = reps as [string, string, string, string];

  const lot = await tx.lotExport.create({
    data: {
      id: uuidv7(),
      name: 'Campagne test',
      cible: LotExportCible.REPRESENTANTS,
      projet: Projet.CHUES,
      filters: {},
      itemCount: 4,
      createdById: awa,
      createdAt: a('2026-03-02', 8),
      items: {
        create: [
          { representantId: rep1, position: 1, assigneeId: awa, day: 1 },
          { representantId: rep2, position: 2, assigneeId: awa, day: 1 },
          { representantId: rep3, position: 3, assigneeId: awa, day: 1 },
          { representantId: rep4, position: 4, assigneeId: bineta, day: 2 },
        ],
      },
    },
    select: { id: true },
  });

  const tentatives: [string, RepCallOutcome, Date, string | null][] = [
    [rep1, RepCallOutcome.UNREACHABLE, a('2026-03-02', 9), null],
    [rep1, RepCallOutcome.UNREACHABLE, a('2026-03-02', 10), null],
    [rep1, RepCallOutcome.REACHED, a('2026-03-02', 11), statut.id],
    [rep2, RepCallOutcome.UNREACHABLE, a('2026-03-02', 12), null],
    [rep3, RepCallOutcome.REACHED, a('2026-03-01', 9), null],
  ];
  for (const [representantId, outcome, clientCreatedAt, statutQualificationId] of tentatives) {
    await tx.repCallAttempt.create({
      data: {
        id: uuidv7(),
        representantId,
        performedById: awa,
        outcome,
        clientCreatedAt,
        statutQualificationId,
      },
    });
  }

  const client = new Proxy(tx, {
    get: (cible, propriete, recepteur) => Reflect.get(cible, propriete, recepteur) as unknown,
  }) as unknown as PrismaService;
  return { service: new CampagnesService(client), awa, bineta, lotId: lot.id };
}

async function surLeJeu<T>(run: (decor: Decor) => Promise<T>): Promise<T> {
  const boite: { valeur?: T } = {};
  const erreur = await prisma
    .$transaction(
      async (tx) => {
        await tx.repCallAttempt.deleteMany({});
        await tx.lotExport.deleteMany({});
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

describe('les campagnes de la fenêtre', () => {
  it('compte une fiche une fois, appelée ou traitée, depuis la création du lot', async () => {
    const { items, totals } = await surLeJeu(({ service }) => service.campagnes(FENETRE));

    expect(items).toHaveLength(1);
    expect(totals.prevues).toBe(4);
    expect(totals.appelees).toBe(2);
    expect(totals.traitees).toBe(2);
    expect(totals.contactRate).toBe(50);
    expect(totals.exploitationRate).toBe(50);
  });

  it('détaille chaque téléconseiller sur ses propres fiches', async () => {
    const lot = await surLeJeu(async ({ service }) => (await service.campagnes(FENETRE)).items[0]);

    const [awa, bineta] = lot?.parTeleconseiller ?? [];
    expect(awa?.prevues).toBe(3);
    expect(awa?.appelees).toBe(2);
    expect(awa?.contactRate).toBe(66.7);
    expect(bineta?.prevues).toBe(1);
    expect(bineta?.appelees).toBe(0);
    expect(bineta?.contactRate).toBe(0);
  });

  it('borne les fiches prévues aux jours de programme de la fenêtre', async () => {
    const totals = await surLeJeu(
      async ({ service }) =>
        (await service.campagnes({ actFrom: '2026-03-02', actTo: '2026-03-02' })).totals,
    );

    expect(totals.prevues).toBe(3);
    expect(totals.appelees).toBe(2);
  });

  it('un seul téléconseiller demandé : ses fiches seulement', async () => {
    const totals = await surLeJeu(
      async ({ service, bineta }) =>
        (await service.campagnes({ ...FENETRE, commercialId: bineta })).totals,
    );

    expect(totals.prevues).toBe(1);
    expect(totals.contactRate).toBe(0);
  });

  it('fenêtre sans campagne : rien, et des taux à null plutôt qu’à zéro', async () => {
    const { items, totals } = await surLeJeu(({ service }) =>
      service.campagnes({ actFrom: '2026-04-01', actTo: '2026-04-30' }),
    );

    expect(items).toEqual([]);
    expect(totals.prevues).toBe(0);
    expect(totals.contactRate).toBeNull();
    expect(totals.exploitationRate).toBeNull();
  });
});
