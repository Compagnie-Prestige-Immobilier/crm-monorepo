/**
 * Tests de synchronisation contre un VRAI PostgreSQL.
 *
 * Les tests unitaires (`sync.service.test.ts`) vérifient la logique ; ceux-ci
 * vérifient ce qu'aucune doublure ne peut démontrer : l'atomicité réelle de
 * `INSERT ... ON CONFLICT DO NOTHING`, l'annulation effective d'une transaction,
 * et le comportement de la pagination keyset sur des lignes qui partagent
 * réellement le même horodatage.
 *
 * Lancés par `pnpm test:integration`, jamais par `pnpm test` : ils exigent la
 * base de développement sur localhost:5434.
 */
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import { randomUUID } from 'node:crypto';

import { PrismaClient, PrismaPg, Role } from '@crm/database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Phase2SyncService } from '../phase2/phase2-sync.service.js';
import { SyncBatchStore } from './batch-store.js';
import { SyncService } from './sync.service.js';
import { SyncEntity, SyncOp, SyncOpStatus } from './dto.js';
import type { SyncOperationDto, SyncPushDto } from './dto.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const sync = new SyncService(
  prisma as unknown as PrismaService,
  new SyncBatchStore(prisma as unknown as PrismaService),
  new Phase2SyncService(),
  fakeDemoVisibility(),
);

/** Marqueur porté par toutes les lignes créées ici, pour un nettoyage sûr. */
const TAG = 'it-sync';

let alice: AuthenticatedUser;
let bob: AuthenticatedUser;
let departementId: string;
let banqueId: string;
let syndicatId: string;
/** Base de numérotation, décalée à chaque suite pour éviter les collisions. */
let phoneSeed = 0;

const nextPhone = (): string => `+22177${String(1_000_000 + ++phoneSeed).slice(-7)}`;

async function cleanup(): Promise<void> {
  await prisma.syncOperation.deleteMany({ where: { userId: { in: [alice.id, bob.id] } } });
  await prisma.syncBatch.deleteMany({ where: { userId: { in: [alice.id, bob.id] } } });
  await prisma.prospect.deleteMany({ where: { createdById: { in: [alice.id, bob.id] } } });
  await prisma.representant.deleteMany({ where: { createdById: { in: [alice.id, bob.id] } } });
}

beforeAll(async () => {
  const departement = await prisma.departement.findFirstOrThrow();
  const banque = await prisma.banque.findFirstOrThrow();
  const syndicat = await prisma.syndicat.findFirstOrThrow();
  departementId = departement.id;
  banqueId = banque.id;
  syndicatId = syndicat.id;

  const makeUser = async (username: string, fullName: string): Promise<AuthenticatedUser> => {
    const row = await prisma.user.upsert({
      where: { email: `${username}.${TAG}@cpi.test` },
      create: {
        email: `${username}.${TAG}@cpi.test`,
        username: `${username}.${TAG}`,
        fullName,
        passwordHash: 'x',
        role: Role.COMMERCIAL,
      },
      update: {},
    });
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      fullName: row.fullName,
      role: Role.COMMERCIAL,
    };
  };

  alice = await makeUser('alice', 'Alice Diop');
  bob = await makeUser('bob', 'Bob Sarr');
  await cleanup();
});

beforeEach(cleanup);

afterAll(async () => {
  await cleanup();
  await prisma.user.deleteMany({ where: { email: { endsWith: `.${TAG}@cpi.test` } } });
  await prisma.$disconnect();
});

// ─── Fabriques ──────────────────────────────────────────────────────────────

const repOp = (entityId: string, phone: string, seq = 0): SyncOperationDto => ({
  opId: randomUUID(),
  seq,
  entity: SyncEntity.REPRESENTANT,
  op: SyncOp.CREATE,
  entityId,
  clientUpdatedAt: new Date().toISOString(),
  data: { fullName: `Rep ${TAG}`, phone, departementId },
});

const prospectOp = (
  entityId: string,
  representantId: string,
  phone: string,
  seq: number,
): SyncOperationDto => ({
  opId: randomUUID(),
  seq,
  entity: SyncEntity.PROSPECT,
  op: SyncOp.CREATE,
  entityId,
  clientUpdatedAt: new Date().toISOString(),
  data: { nom: 'Fall', prenom: 'Moussa', phone, banqueId, syndicatId, representantId },
});

const push = (operations: SyncOperationDto[], clientBatchId = randomUUID()): SyncPushDto => ({
  clientBatchId,
  payloadVersion: 1,
  operations,
});

const statuses = (results: { status: SyncOpStatus }[]): SyncOpStatus[] =>
  results.map((result) => result.status);

/**
 * Recule `updatedAt` pour sortir les lignes du retard de sécurité de 2 s sans
 * faire attendre la suite. On passe par du SQL brut : `@updatedAt` réécrirait
 * la valeur à chaque `update` Prisma.
 */
async function backdate(): Promise<void> {
  await prisma.$executeRaw`UPDATE "representants" SET "updatedAt" = now() - interval '10 seconds'`;
  await prisma.$executeRaw`UPDATE "prospects" SET "updatedAt" = now() - interval '10 seconds'`;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('idempotence contre PostgreSQL', () => {
  it('le même lot envoyé deux fois ne produit QU’UNE ligne', async () => {
    const body = push([repOp(randomUUID(), nextPhone())]);

    const first = await sync.push(alice, body);
    const second = await sync.push(alice, body);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.body).toEqual(first.body);

    expect(await prisma.representant.count({ where: { createdById: alice.id } })).toBe(1);
    expect(await prisma.syncBatch.count({ where: { userId: alice.id } })).toBe(1);
    expect(await prisma.syncOperation.count({ where: { userId: alice.id } })).toBe(1);
  });

  it('trois lots concurrents portant la même clé n’en laissent passer qu’un', async () => {
    const body = push([repOp(randomUUID(), nextPhone())]);

    const outcomes = await Promise.allSettled([
      sync.push(alice, body),
      sync.push(alice, body),
      sync.push(alice, body),
    ]);

    const applied = outcomes.filter(
      (outcome) => outcome.status === 'fulfilled' && !outcome.value.replayed,
    );
    // ON CONFLICT DO NOTHING est atomique : un seul appel obtient le marqueur,
    // les autres rejouent ou reçoivent IDEMPOTENCY_IN_PROGRESS.
    expect(applied).toHaveLength(1);
    expect(await prisma.representant.count({ where: { createdById: alice.id } })).toBe(1);
  });

  it('une opération rejouée sous un NOUVEAU batchId ressort en duplicate', async () => {
    const operation = repOp(randomUUID(), nextPhone());
    await sync.push(alice, push([operation]));

    const second = await sync.push(alice, push([operation, repOp(randomUUID(), nextPhone(), 1)]));

    expect(statuses(second.body.results)).toEqual([SyncOpStatus.DUPLICATE, SyncOpStatus.APPLIED]);
    expect(await prisma.representant.count({ where: { createdById: alice.id } })).toBe(2);
  });
});

describe('isolation transactionnelle par groupe', () => {
  it('un groupe annulé n’emporte pas le groupe voisin', async () => {
    const repA = randomUUID();
    const repB = randomUUID();
    const operations = [
      repOp(repA, nextPhone(), 0),
      prospectOp(randomUUID(), repA, nextPhone(), 1),
      repOp(repB, nextPhone(), 2),
      // Banque inexistante : la clé étrangère fait réellement échouer la
      // transaction du second groupe, côté serveur.
      {
        opId: randomUUID(),
        seq: 3,
        entity: SyncEntity.PROSPECT,
        op: SyncOp.CREATE,
        entityId: randomUUID(),
        clientUpdatedAt: new Date().toISOString(),
        data: {
          nom: 'X',
          prenom: 'Y',
          phone: nextPhone(),
          banqueId: randomUUID(),
          syndicatId,
          representantId: repB,
        },
      },
    ];

    const result = await sync.push(alice, push(operations));

    expect(statuses(result.body.results).slice(0, 2)).toEqual([
      SyncOpStatus.APPLIED,
      SyncOpStatus.APPLIED,
    ]);
    expect(statuses(result.body.results).slice(2)).toEqual([
      SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
      SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
    ]);

    // Le premier groupe survit intégralement.
    expect(await prisma.representant.findUnique({ where: { id: repA } })).not.toBeNull();
    expect(await prisma.prospect.count({ where: { representantId: repA } })).toBe(1);
    // Le second est intégralement annulé, y compris son marqueur d'opération.
    expect(await prisma.representant.findUnique({ where: { id: repB } })).toBeNull();
    expect(await prisma.syncOperation.count({ where: { opId: operations[2]?.opId ?? '' } })).toBe(
      0,
    );
  });

  it('un doublon de téléphone ne fait pas tomber son groupe', async () => {
    const shared = nextPhone();
    const repA = randomUUID();
    await sync.push(alice, push([repOp(repA, nextPhone())]));
    await sync.push(alice, push([prospectOp(randomUUID(), repA, shared, 0)]));

    const result = await sync.push(
      alice,
      push([
        prospectOp(randomUUID(), repA, shared, 0), // conflit
        prospectOp(randomUUID(), repA, nextPhone(), 1), // doit passer
      ]),
    );

    expect(statuses(result.body.results)).toEqual([SyncOpStatus.CONFLICT, SyncOpStatus.APPLIED]);
    expect(result.body.results[0]?.errorCode).toBe('PROSPECT_PHONE_CONFLICT');
    expect(await prisma.prospect.count({ where: { createdById: alice.id } })).toBe(2);
  });
});

describe('pull, pagination keyset', () => {
  it('ne perd AUCUNE ligne quand elles partagent la même milliseconde', async () => {
    const repId = randomUUID();
    await sync.push(alice, push([repOp(repId, nextPhone())]));

    const ids = Array.from({ length: 9 }, () => randomUUID());
    await sync.push(alice, push(ids.map((id, index) => prospectOp(id, repId, nextPhone(), index))));

    // Toutes les lignes portent exactement le même updatedAt : c'est le cas qui
    // fait silencieusement disparaître une ligne avec un curseur horodaté nu.
    await prisma.$executeRaw`
      UPDATE "prospects" SET "updatedAt" = now() - interval '10 seconds'
      WHERE "createdById" = ${alice.id}
    `;
    await backdate();

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 20; page += 1) {
      const response = await sync.pull(alice, { limit: 2, ...(cursor ? { since: cursor } : {}) });
      seen.push(...response.changes.prospects.map((row) => row.id));
      cursor = response.nextCursor;
      if (!response.hasMore) break;
    }

    expect(new Set(seen).size).toBe(ids.length);
    expect([...seen].sort()).toEqual([...ids].sort());
  });

  it('respecte le retard de sécurité : une écriture toute fraîche n’est pas encore servie', async () => {
    const repId = randomUUID();
    await sync.push(alice, push([repOp(repId, nextPhone())]));

    const response = await sync.pull(alice, {});
    expect(response.changes.representants.map((row) => row.id)).not.toContain(repId);
  });

  it('un COMMERCIAL ne reçoit que ses propres lignes', async () => {
    const repAlice = randomUUID();
    const repBob = randomUUID();
    await sync.push(alice, push([repOp(repAlice, nextPhone())]));
    await sync.push(bob, push([repOp(repBob, nextPhone())]));
    await backdate();

    const forAlice = await sync.pull(alice, { limit: 500 });
    const ids = forAlice.changes.representants.map((row) => row.id);

    expect(ids).toContain(repAlice);
    expect(ids).not.toContain(repBob);
  });

  it('les référentiels traversent le même endpoint, avec leur propre position', async () => {
    const first = await sync.pull(alice, { limit: 3 });
    expect(first.changes.banques.length).toBeGreaterThan(0);

    const second = await sync.pull(alice, { limit: 3, since: first.nextCursor });
    // La deuxième page ne rejoue pas la première.
    const firstIds = new Set(first.changes.banques.map((row) => row.id));
    expect(second.changes.banques.some((row) => firstIds.has(row.id))).toBe(false);
  });

  it('une suppression logique voyage dans `deletions`, pas dans `changes`', async () => {
    const repId = randomUUID();
    const prospectId = randomUUID();
    await sync.push(alice, push([repOp(repId, nextPhone())]));
    await sync.push(alice, push([prospectOp(prospectId, repId, nextPhone(), 0)]));
    await backdate();

    const before = await sync.pull(alice, { limit: 500 });
    expect(before.changes.prospects.map((row) => row.id)).toContain(prospectId);

    await sync.push(alice, {
      clientBatchId: randomUUID(),
      payloadVersion: 1,
      operations: [
        {
          opId: randomUUID(),
          seq: 0,
          entity: SyncEntity.PROSPECT,
          op: SyncOp.DELETE,
          entityId: prospectId,
          clientUpdatedAt: new Date().toISOString(),
        },
      ],
    });
    await backdate();

    const after = await sync.pull(alice, { limit: 500, since: before.nextCursor });
    expect(after.deletions.map((row) => row.id)).toContain(prospectId);
    expect(after.changes.prospects.map((row) => row.id)).not.toContain(prospectId);
  });
});

describe('index unique partiel sur le téléphone', () => {
  it('un numéro redevient ressaisissable après suppression logique', async () => {
    const phone = nextPhone();
    const repId = randomUUID();
    const first = randomUUID();
    await sync.push(alice, push([repOp(repId, nextPhone())]));
    await sync.push(alice, push([prospectOp(first, repId, phone, 0)]));

    await sync.push(alice, {
      clientBatchId: randomUUID(),
      payloadVersion: 1,
      operations: [
        {
          opId: randomUUID(),
          seq: 0,
          entity: SyncEntity.PROSPECT,
          op: SyncOp.DELETE,
          entityId: first,
          clientUpdatedAt: new Date().toISOString(),
        },
      ],
    });

    // Le commercial ressaisit le même numéro : sans index PARTIEL, la
    // contrainte le lui refuserait à vie.
    const again = await sync.push(alice, push([prospectOp(randomUUID(), repId, phone, 0)]));
    expect(statuses(again.body.results)).toEqual([SyncOpStatus.APPLIED]);
  });
});
