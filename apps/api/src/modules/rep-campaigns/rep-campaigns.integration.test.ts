/**
 * Le tirage des campagnes de représentants, contre un VRAI PostgreSQL.
 *
 * Deux mécanismes de ce module ne vivent PAS dans le code applicatif, et
 * aucune doublure ne peut donc les éprouver :
 *
 *  1. le MÉLANGE. Il est exécuté par PostgreSQL (`setseed` puis
 *     `ORDER BY random()`), sur la connexion de la transaction. La graine est
 *     conservée dans la campagne parce qu'elle est censée rendre le tirage
 *     REJOUABLE : c'est une promesse d'audit, et une promesse qu'on ne peut
 *     tenir qu'en la vérifiant sur le moteur lui-même. Une doublure qui rend la
 *     liste inchangée, comme le font les tests unitaires, ne prouve rien du
 *     tout ;
 *  2. l'index unique PARTIEL `rep_call_tasks_one_active_per_representant`. Le
 *     service pose bien un pré-contrôle applicatif
 *     (`repCallTasks: { none: { isActive: true } }`), mais un pré-contrôle LIT
 *     puis ÉCRIT : deux campagnes créées à la même seconde le franchissent
 *     toutes les deux. C'est l'index qui arbitre pour de bon, et c'est lui
 *     qu'il faut mettre à l'épreuve.
 *
 * Lancée par `pnpm test:integration`.
 */
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import { CallTaskStatus, CampaignStatus, PrismaClient, PrismaPg, Role } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { shuffleInPostgres, toPostgresSeed } from '../phase2/distribution.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TAG = 'ITRC';

/** Deux graines distinctes, écrites en dur : le rejeu doit être REPRODUCTIBLE. */
const SEED_A = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';
const SEED_B = 'ffeeddccbbaa99887766554433221100';

let departementId: string;
let adminId: string;
let commercialId: string;
let representantIds: string[] = [];

async function cleanupCampagnes(): Promise<void> {
  await prisma.repCallAttempt.deleteMany({ where: { campaign: { name: { startsWith: TAG } } } });
  await prisma.repCallTask.deleteMany({ where: { campaign: { name: { startsWith: TAG } } } });
  await prisma.repCallCampaignCommercial.deleteMany({
    where: { campaign: { name: { startsWith: TAG } } },
  });
  await prisma.repCallCampaign.deleteMany({ where: { name: { startsWith: TAG } } });
}

async function cleanupAll(): Promise<void> {
  await cleanupCampagnes();
  await prisma.representant.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG.toLowerCase() } } });
}

beforeAll(async () => {
  await cleanupAll();

  const departement = await prisma.departement.findFirstOrThrow({ select: { id: true } });
  departementId = departement.id;

  const [admin, commercial] = await Promise.all([
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
    prisma.user.create({
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
    }),
  ]);
  adminId = admin.id;
  commercialId = commercial.id;

  // Une population assez grande pour qu'un ordre identique par HASARD soit
  // hors de portée : 40! est un nombre à cinquante chiffres.
  representantIds = [];
  for (let index = 0; index < 40; index += 1) {
    const row = await prisma.representant.create({
      data: {
        id: uuidv7(),
        fullName: `${TAG} Rep ${String(index).padStart(2, '0')}`,
        phoneE164: `+2217709920${String(index).padStart(2, '0')}`,
        departementId,
        createdById: commercialId,
        clientCreatedAt: new Date('2026-01-02T09:00:00.000Z'),
      },
      select: { id: true },
    });
    representantIds.push(row.id);
  }
});

afterAll(async () => {
  await cleanupAll();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanupCampagnes();
});

/** Crée une campagne et rend l'ORDRE dans lequel le tirage a rangé les fiches. */
async function tirage(nom: string, seed: string): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const campagne = await tx.repCallCampaign.create({
      data: {
        id: uuidv7(),
        name: `${TAG} ${nom}`,
        seed,
        spreadDays: 1,
        status: CampaignStatus.ACTIVE,
        createdById: adminId,
        departementId,
      },
      select: { id: true },
    });

    const ordonnes = await shuffleInPostgres(tx, seed, representantIds);

    await tx.repCallTask.createMany({
      data: ordonnes.map((representantId, index) => ({
        id: uuidv7(),
        campaignId: campagne.id,
        representantId,
        assignedToId: commercialId,
        position: index + 1,
        dayIndex: 0,
        status: CallTaskStatus.OPEN,
        // Inactif : ces campagnes-ci ne servent qu'à comparer des ORDRES, et
        // l'index d'unicité les ferait s'exclure entre elles.
        isActive: false,
      })),
    });

    return ordonnes;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Le rejeu à graine égale
// ─────────────────────────────────────────────────────────────────────────────

describe('mélange ensemencé : deux campagnes, même graine, même ordre', () => {
  /**
   * La promesse tenue par la graine conservée en base : à population égale, le
   * tirage se REJOUE. C'est ce qui permet, six mois plus tard, de démontrer
   * qu'une campagne n'a pas été arrangée en faveur de tel commercial.
   */
  it('même graine et même population donnent un ordre IDENTIQUE', async () => {
    const premier = await tirage('Campagne 1', SEED_A);
    const second = await tirage('Campagne 2', SEED_A);

    expect(second).toEqual(premier);
    // Garde-fou : sans lui, deux listes vides seraient « identiques ».
    expect(premier).toHaveLength(representantIds.length);
  });

  /**
   * Le témoin négatif, sans lequel le précédent ne prouverait rien : un mélange
   * qui ne mélangerait PAS rendrait aussi deux ordres identiques.
   */
  it('deux graines DIFFÉRENTES donnent un ordre différent', async () => {
    const avecA = await tirage('Campagne A', SEED_A);
    const avecB = await tirage('Campagne B', SEED_B);

    expect(avecB).not.toEqual(avecA);
    // Ce sont bien les MÊMES fiches, rangées autrement.
    expect([...avecB].sort()).toEqual([...avecA].sort());
  });

  it('le mélange bouscule réellement l’ordre d’entrée', async () => {
    // Un `ORDER BY random()` que PostgreSQL optimiserait en no-op rendrait la
    // liste telle quelle, et le rejeu ci-dessus resterait vert.
    const ordonnes = await tirage('Campagne mélangée', SEED_A);
    expect(ordonnes).not.toEqual(representantIds);
    expect([...ordonnes].sort()).toEqual([...representantIds].sort());
  });

  it('la graine reste dans l’intervalle admis par setseed', () => {
    for (const seed of [SEED_A, SEED_B]) {
      expect(toPostgresSeed(seed)).toBeGreaterThanOrEqual(-1);
      expect(toPostgresSeed(seed)).toBeLessThan(1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. L'index, et non le pré-contrôle
// ─────────────────────────────────────────────────────────────────────────────

describe('index rep_call_tasks_one_active_per_representant', () => {
  /** Écrit UNE tâche active sur un représentant, hors de tout pré-contrôle. */
  const tacheActive = async (nom: string, representantId: string): Promise<void> => {
    const campagne = await prisma.repCallCampaign.create({
      data: {
        id: uuidv7(),
        name: `${TAG} ${nom}`,
        seed: SEED_A,
        spreadDays: 1,
        status: CampaignStatus.ACTIVE,
        createdById: adminId,
        departementId,
      },
      select: { id: true },
    });

    await prisma.repCallTask.create({
      data: {
        id: uuidv7(),
        campaignId: campagne.id,
        representantId,
        assignedToId: commercialId,
        position: 1,
        dayIndex: 0,
        status: CallTaskStatus.OPEN,
        isActive: true,
      },
    });
  };

  /**
   * LE POINT DE L'ÉPREUVE : le refus vient de la BASE, pas du service.
   *
   * On écrit ici directement, en contournant délibérément le pré-contrôle
   * applicatif, exactement comme le ferait une seconde transaction concurrente
   * qui l'aurait franchi avant que la première ne valide. Le code de l'erreur
   * doit être P2002, celui que le filtre global traduit en 409 typé, et non une
   * exception métier levée par le service.
   */
  it('REFUSE une deuxième tâche ACTIVE sur le même représentant', async () => {
    const cible = representantIds[0] ?? '';
    await tacheActive('Première', cible);

    const erreur = await tacheActive('Seconde', cible)
      .then(() => null)
      .catch((caught: unknown) => (caught as { code?: string }).code ?? String(caught));

    expect(erreur).toBe('P2002');
    expect(
      await prisma.repCallTask.count({ where: { representantId: cible, isActive: true } }),
    ).toBe(1);
  });

  /**
   * L'index est PARTIEL sur `isActive = true`, et c'est tout son intérêt : un
   * représentant déjà appelé garde l'HISTORIQUE de ses anciennes tâches, closes
   * donc inactives, et doit pouvoir entrer dans une nouvelle campagne. Un index
   * total interdirait toute relance, ce qui viderait le module de son objet.
   */
  it('AUTORISE une nouvelle tâche quand la précédente n’est plus active', async () => {
    const cible = representantIds[1] ?? '';
    await tacheActive('Ancienne', cible);

    await prisma.repCallTask.updateMany({
      where: { representantId: cible, isActive: true },
      data: { isActive: false, status: CallTaskStatus.DONE },
    });

    await expect(tacheActive('Nouvelle', cible)).resolves.toBeUndefined();

    expect(await prisma.repCallTask.count({ where: { representantId: cible } })).toBe(2);
    expect(
      await prisma.repCallTask.count({ where: { representantId: cible, isActive: true } }),
    ).toBe(1);
  });

  it('AUTORISE deux tâches actives sur deux représentants distincts', async () => {
    await tacheActive('Un', representantIds[2] ?? '');
    await tacheActive('Deux', representantIds[3] ?? '');

    expect(
      await prisma.repCallTask.count({
        where: { isActive: true, campaign: { name: { startsWith: TAG } } },
      }),
    ).toBe(2);
  });
});
