import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { Role } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Phase2SyncService } from '../phase2/phase2-sync.service.js';
import { SyncBatchStore } from './batch-store.js';
import { SyncService } from './sync.service.js';
import { FakePrisma } from './fake-prisma.js';
import { SyncEntity, SyncOp, SyncOpStatus, dependencyKeyOf } from './dto.js';
import type { SyncOperationDto, SyncPushDto } from './dto.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

const alice: AuthenticatedUser = {
  id: 'com-alice',
  email: 'alice@cpi.sn',
  username: 'alice',
  fullName: 'Alice Diop',
  role: Role.COMMERCIAL,
};
const bob: AuthenticatedUser = { ...alice, id: 'com-bob', username: 'bob', fullName: 'Bob Sarr' };

const REP_A = '0198a000-0000-7000-8000-000000000001';
const REP_B = '0198a000-0000-7000-8000-000000000002';
const COMMENT_A = '0198a000-0000-7000-8000-000000000003';

let db: FakePrisma;
let sync: SyncService;

beforeEach(() => {
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm';
  process.env.NODE_ENV ??= 'test';

  db = new FakePrisma();
  const prisma = db as unknown as PrismaService;
  sync = new SyncService(
    prisma,
    new SyncBatchStore(prisma),
    new Phase2SyncService(),
    fakeDemoVisibility(),
  );
});

let counter = 0;
const opId = (): string => `0198b000-0000-7000-8000-${String(++counter).padStart(12, '0')}`;

function createRep(entityId: string, phone: string, seq = 0): SyncOperationDto {
  return {
    opId: opId(),
    seq,
    entity: SyncEntity.REPRESENTANT,
    op: SyncOp.CREATE,
    entityId,
    clientUpdatedAt: '2026-08-10T10:00:00.000Z',
    data: {
      fullName: `Rep ${entityId.slice(-1)}`,
      phone,
      departementId: '0198c000-0000-7000-8000-000000000001',
    },
  };
}

function createProspect(
  entityId: string,
  representantId: string,
  phone: string,
  seq: number,
): SyncOperationDto {
  return {
    opId: opId(),
    seq,
    entity: SyncEntity.PROSPECT,
    op: SyncOp.CREATE,
    entityId,
    clientUpdatedAt: '2026-08-10T10:00:00.000Z',
    data: {
      nom: 'Fall',
      prenom: 'Moussa',
      phone,
      banqueId: '0198d000-0000-7000-8000-000000000001',
      syndicatId: '0198e000-0000-7000-8000-000000000001',
      representantId,
    },
  };
}

const batch = (operations: SyncOperationDto[], id = 'batch-1'): SyncPushDto => ({
  clientBatchId: id,
  payloadVersion: 1,
  operations,
});

const statuses = (results: { status: SyncOpStatus }[]): SyncOpStatus[] =>
  results.map((result) => result.status);

describe('idempotence, niveau 1 (le lot)', () => {
  it('rejouer le MÊME lot n’écrit qu’une fois et rejoue la réponse mémorisée', async () => {
    const body = batch([createRep(REP_A, '77 123 45 67')]);

    const first = await sync.push(alice, body);
    expect(first.replayed).toBe(false);
    expect(statuses(first.body.results)).toEqual([SyncOpStatus.APPLIED]);
    expect(db.representants.size).toBe(1);

    const second = await sync.push(alice, body);
    expect(second.replayed).toBe(true);
    expect(db.representants.size).toBe(1);
    expect(second.body).toEqual(first.body);
  });

  it('le marqueur du lot est posé HORS de la transaction de travail', async () => {
    const body = batch([createRep(REP_A, '77 123 45 67')]);
    await sync.push(alice, body);
    expect(db.batches.size).toBe(1);
    expect([...db.batches.values()][0]?.status).toBe('COMPLETED');
  });

  it('même clé, contenu différent → 422 explicite plutôt qu’une réponse sans rapport', async () => {
    await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')]));

    await expect(sync.push(alice, batch([createRep(REP_B, '77 000 00 00')]))).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('un traitement déjà en cours répond 409 IDEMPOTENCY_IN_PROGRESS', async () => {
    db.batches.set('com-alice|batch-1', {
      key: 'batch-1',
      userId: 'com-alice',
      requestHash: 'peu-importe',
      status: 'IN_PROGRESS',
      httpStatus: null,
      responseJson: null,
      createdAt: new Date(),
      completedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await expect(sync.push(alice, batch([createRep(REP_A, '77 123 45 67')]))).rejects.toThrow(
      ConflictException,
    );
  });

  it('un marqueur IN_PROGRESS abandonné depuis plus de 60 s est repris', async () => {
    db.batches.set('com-alice|batch-1', {
      key: 'batch-1',
      userId: 'com-alice',
      requestHash: 'abandonne',
      status: 'IN_PROGRESS',
      httpStatus: null,
      responseJson: null,
      createdAt: new Date(Date.now() - 120_000),
      completedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const result = await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')]));
    expect(statuses(result.body.results)).toEqual([SyncOpStatus.APPLIED]);
  });

  it('la clé d’un utilisateur n’est pas celle d’un autre', async () => {
    await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')]));
    const other = await sync.push(bob, batch([createRep(REP_B, '77 000 00 00')]));
    expect(other.replayed).toBe(false);
    expect(db.batches.size).toBe(2);
  });
});

describe('idempotence, niveau 2 (l’opération)', () => {
  it('enregistre un commentaire hors ligne une seule fois', async () => {
    await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')], 'comment-parent'));
    const operation = {
      opId: opId(),
      seq: 0,
      entity: 'representant_comment' as SyncEntity,
      op: SyncOp.CREATE,
      entityId: COMMENT_A,
      clientUpdatedAt: '2026-08-10T10:05:00.000Z',
      data: {
        representantId: REP_A,
        body: 'Rappelle à 15 h.',
        clientCreatedAt: '2026-08-10T10:05:00.000Z',
      },
    } as unknown as SyncOperationDto;

    const first = await sync.push(alice, batch([operation], 'comment-1'));
    const replay = await sync.push(alice, batch([operation], 'comment-2'));

    expect(statuses(first.body.results)).toEqual([SyncOpStatus.APPLIED]);
    expect(statuses(replay.body.results)).toEqual([SyncOpStatus.DUPLICATE]);
    expect(db.representantComments.size).toBe(1);
  });

  it('une opération déjà appliquée dans un AUTRE lot ressort en duplicate, sans réécriture', async () => {
    const operation = createRep(REP_A, '77 123 45 67');
    await sync.push(alice, batch([operation], 'batch-1'));
    expect(db.representants.get(REP_A)?.rev).toBe(1);

    const second = await sync.push(
      alice,
      batch([operation, createRep(REP_B, '76 555 44 33', 1)], 'batch-2'),
    );

    expect(statuses(second.body.results)).toEqual([SyncOpStatus.DUPLICATE, SyncOpStatus.APPLIED]);
    expect(db.representants.get(REP_A)?.rev).toBe(1);
    expect(db.representants.size).toBe(2);
  });

  it('une opération REFUSÉE rejouée réémet son refus, pas un duplicate', async () => {
    await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')], 'batch-1'));

    const stale: SyncOperationDto = {
      opId: opId(),
      seq: 0,
      entity: SyncEntity.REPRESENTANT,
      op: SyncOp.UPDATE,
      entityId: REP_A,
      clientUpdatedAt: '2026-08-10T11:00:00.000Z',
      baseRev: 99,
      data: { fullName: 'Écrasé', phone: '77 123 45 67' },
    };

    const first = await sync.push(alice, batch([stale], 'batch-2'));
    expect(statuses(first.body.results)).toEqual([SyncOpStatus.CONFLICT]);
    expect(first.body.results[0]?.errorCode).toBe('REV_CONFLICT');

    const replay = await sync.push(alice, batch([stale], 'batch-3'));
    expect(statuses(replay.body.results)).toEqual([SyncOpStatus.CONFLICT]);
    expect(replay.body.results[0]?.errorCode).toBe('REV_CONFLICT');
    expect(db.representants.get(REP_A)?.fullName).not.toBe('Écrasé');
  });

  it('un verdict INCONNU du serveur se rejoue en INVALID, JAMAIS en duplicate', async () => {
    await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')], 'batch-1'));

    const operation = createRep(REP_B, '77 222 22 22');
    const premier = await sync.push(alice, batch([operation], 'batch-2'));
    expect(statuses(premier.body.results)).toEqual([SyncOpStatus.APPLIED]);

    const memoire = db.operations.get(operation.opId);
    expect(memoire, 'l’opération devrait être mémorisée').toBeDefined();
    if (memoire) memoire.result = 'QUARANTINED';

    const rejeu = await sync.push(alice, batch([operation], 'batch-3'));
    const ligne = rejeu.body.results[0];

    expect(ligne?.status).toBe(SyncOpStatus.INVALID);
    expect(ligne?.status).not.toBe(SyncOpStatus.DUPLICATE);
    expect(ligne?.errorCode).toBe('UNKNOWN_STORED_RESULT');
    expect(ligne?.error).toContain('inconnu');
  });

  it('un verdict CONNU se rejoue toujours en duplicate, sans code d’erreur', async () => {
    const operation = createRep(REP_A, '77 123 45 67');
    await sync.push(alice, batch([operation], 'batch-1'));

    const rejeu = await sync.push(alice, batch([operation], 'batch-2'));
    const ligne = rejeu.body.results[0];

    expect(ligne?.status).toBe(SyncOpStatus.DUPLICATE);
    expect(ligne?.errorCode).toBeNull();
  });
});

describe('nature du prospect lors d’un rattachement', () => {
  it('suit le représentant de démonstration lors d’une mise à jour hors ligne', async () => {
    db.representants.set(REP_A, {
      id: REP_A,
      fullName: 'Représentant réel',
      phoneE164: '+221771111111',
      notes: null,
      rev: 1,
      departementId: '0198c000-0000-7000-8000-000000000001',
      createdById: alice.id,
      clientCreatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      isDemo: false,
    });
    db.representants.set(REP_B, {
      id: REP_B,
      fullName: 'Représentant fictif',
      phoneE164: '+221772222222',
      notes: null,
      rev: 1,
      departementId: '0198c000-0000-7000-8000-000000000001',
      createdById: alice.id,
      clientCreatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      isDemo: true,
    });
    db.prospects.set('prospect-1', {
      id: 'prospect-1',
      nom: 'Fall',
      prenom: 'Moussa',
      phoneE164: '+221773333333',
      rev: 1,
      statut: 'NOUVEAU',
      banqueId: '0198d000-0000-7000-8000-000000000001',
      syndicatId: '0198e000-0000-7000-8000-000000000001',
      representantId: REP_A,
      createdById: alice.id,
      clientCreatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      isDemo: false,
    });

    const operation: SyncOperationDto = {
      opId: opId(),
      seq: 0,
      entity: SyncEntity.PROSPECT,
      op: SyncOp.UPDATE,
      entityId: 'prospect-1',
      clientUpdatedAt: '2026-08-10T11:00:00.000Z',
      baseRev: 1,
      data: { phone: '77 333 33 33', representantId: REP_B },
    };

    const result = await sync.push(alice, batch([operation], 'demo-reassignment'));

    expect(statuses(result.body.results)).toEqual([SyncOpStatus.APPLIED]);
    expect(db.prospects.get('prospect-1')?.isDemo).toBe(true);
  });
});

describe('granularité transactionnelle, une transaction par groupe', () => {
  it('groupe le prospect avec SON représentant', () => {
    expect(dependencyKeyOf(createRep(REP_A, '77 123 45 67'))).toBe(`representant:${REP_A}`);
    expect(dependencyKeyOf(createProspect('p-1', REP_A, '77 111 11 11', 1))).toBe(
      `representant:${REP_A}`,
    );
    expect(dependencyKeyOf({ entity: SyncEntity.PROSPECT, entityId: 'p-9', data: undefined })).toBe(
      'prospect:p-9',
    );
  });

  it('ouvre une transaction PAR GROUPE, pas une pour tout le lot', async () => {
    await sync.push(
      alice,
      batch([
        createRep(REP_A, '77 123 45 67', 0),
        createProspect('0198f000-0000-7000-8000-000000000001', REP_A, '77 111 11 11', 1),
        createRep(REP_B, '76 555 44 33', 2),
        createProspect('0198f000-0000-7000-8000-000000000002', REP_B, '78 222 22 22', 3),
      ]),
    );

    expect(db.transactionCount).toBe(2);
    expect(db.representants.size).toBe(2);
    expect(db.prospects.size).toBe(2);
  });

  it('un conflit de téléphone n’annule PAS les écritures valides du même groupe', async () => {
    db.prospects.set('deja-la', {
      id: 'deja-la',
      nom: 'Autre',
      prenom: 'Personne',
      phoneE164: '+221771111111',
      rev: 1,
      statut: 'NOUVEAU',
      banqueId: 'b',
      syndicatId: 's',
      representantId: 'r',
      createdById: bob.id,
      clientCreatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const result = await sync.push(
      alice,
      batch([
        createRep(REP_A, '77 123 45 67', 0),
        createProspect('0198f000-0000-7000-8000-000000000010', REP_A, '77 111 11 11', 1),
        createProspect('0198f000-0000-7000-8000-000000000011', REP_A, '78 222 22 22', 2),
      ]),
    );

    expect(statuses(result.body.results)).toEqual([
      SyncOpStatus.APPLIED,
      SyncOpStatus.CONFLICT,
      SyncOpStatus.APPLIED,
    ]);
    expect(db.rollbackCount).toBe(0);
    expect(db.representants.size).toBe(1);
    expect(db.prospects.size).toBe(2);

    const conflict = result.body.results[1];
    expect(conflict?.errorCode).toBe('PROSPECT_PHONE_CONFLICT');
  });

  it('l’échec d’un groupe laisse intact le groupe voisin', async () => {
    const operations = [
      createRep(REP_A, '77 123 45 67', 0),
      createProspect('0198f000-0000-7000-8000-000000000020', REP_A, '77 111 11 11', 1),
      createRep(REP_B, '76 555 44 33', 2),
      createProspect('0198f000-0000-7000-8000-000000000021', REP_B, '78 222 22 22', 3),
    ];

    const upsert = db.representant.upsert.bind(db.representant);
    db.representant.upsert = (args) => {
      if (args.where.id === REP_B) throw new Error('panne simulée du serveur');
      return upsert(args);
    };

    const result = await sync.push(alice, batch(operations));

    expect(db.rollbackCount).toBe(1);
    expect(statuses(result.body.results)).toEqual([
      SyncOpStatus.APPLIED,
      SyncOpStatus.APPLIED,
      SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
      SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
    ]);

    expect(db.representants.has(REP_A)).toBe(true);
    expect(db.prospects.size).toBe(1);
    expect(db.representants.has(REP_B)).toBe(false);
  });

  it('un prospect n’atterrit jamais sans son représentant', async () => {
    const rep = createRep(REP_A, '77 123 45 67', 0);
    delete rep.data?.departementId;

    const result = await sync.push(
      alice,
      batch([
        rep,
        createProspect('0198f000-0000-7000-8000-000000000030', REP_A, '77 111 11 11', 1),
      ]),
    );

    expect(statuses(result.body.results)).toEqual([
      SyncOpStatus.INVALID,
      SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
    ]);
    expect(db.prospects.size).toBe(0);
  });
});

describe('garde anti-squat d’identifiant', () => {
  it('refuse de réécrire la ligne d’un autre commercial', async () => {
    db.representants.set(REP_A, {
      id: REP_A,
      fullName: 'Fiche de Bob',
      phoneE164: '+221770000000',
      notes: null,
      rev: 3,
      departementId: 'd',
      createdById: bob.id,
      clientCreatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const result = await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')]));

    expect(statuses(result.body.results)).toEqual([SyncOpStatus.CONFLICT]);
    expect(result.body.results[0]?.errorCode).toBe('ENTITY_ID_OWNED_BY_ANOTHER_USER');
    expect(db.representants.get(REP_A)?.fullName).toBe('Fiche de Bob');
    expect(db.representants.get(REP_A)?.rev).toBe(3);
  });
});

describe('une campagne ouvre l’écriture sur la fiche d’un autre', () => {
  const PROSPECT_DE_BOB = '0198a000-0000-7000-8000-000000000009';

  function ficheDeBob(): void {
    db.prospects.set(PROSPECT_DE_BOB, {
      id: PROSPECT_DE_BOB,
      nom: 'Fall',
      prenom: 'Moussa',
      phoneE164: '+221770000009',
      rev: 2,
      banqueId: 'b',
      syndicatId: 's',
      representantId: REP_B,
      createdById: bob.id,
      statut: 'NOUVEAU',
      phase2Status: 'PENDING',
      enrollmentMethod: null,
      enrollmentCapturedById: null,
      enrollmentCapturedAt: null,
      clientCreatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      isDemo: false,
    });
  }

  const qualifier = (): SyncOperationDto => ({
    opId: opId(),
    seq: 0,
    entity: SyncEntity.PROSPECT,
    op: SyncOp.UPDATE,
    entityId: PROSPECT_DE_BOB,
    clientUpdatedAt: new Date().toISOString(),
    data: {
      nom: 'Fall',
      prenom: 'Moussa',
      phone: '77 000 00 09',
      banqueId: 'b',
      syndicatId: 's',
      representantId: REP_B,
    },
  });

  it('sans file, la fiche d’un autre reste fermée', async () => {
    ficheDeBob();

    const result = await sync.push(alice, batch([qualifier()]));

    expect(statuses(result.body.results)).toEqual([SyncOpStatus.CONFLICT]);
    expect(result.body.results[0]?.errorCode).toBe('ENTITY_ID_OWNED_BY_ANOTHER_USER');
  });

  it('la file de la campagne l’ouvre à qui elle l’a confiée', async () => {
    ficheDeBob();
    db.callTasks.set('task-1', {
      id: 'task-1',
      prospectId: PROSPECT_DE_BOB,
      assignedToId: alice.id,
      isActive: true,
      isDemo: false,
    });

    const result = await sync.push(alice, batch([qualifier()]));

    expect(statuses(result.body.results)).toEqual([SyncOpStatus.APPLIED]);
  });

  it('une file confiée à un TIERS ne l’ouvre pas', async () => {
    ficheDeBob();
    db.callTasks.set('task-1', {
      id: 'task-1',
      prospectId: PROSPECT_DE_BOB,
      assignedToId: 'com-carine',
      isActive: true,
      isDemo: false,
    });

    const result = await sync.push(alice, batch([qualifier()]));

    expect(statuses(result.body.results)).toEqual([SyncOpStatus.CONFLICT]);
  });

  it('une file RETIRÉE ne l’ouvre plus', async () => {
    ficheDeBob();
    db.callTasks.set('task-1', {
      id: 'task-1',
      prospectId: PROSPECT_DE_BOB,
      assignedToId: alice.id,
      isActive: false,
      isDemo: false,
    });

    const result = await sync.push(alice, batch([qualifier()]));

    expect(statuses(result.body.results)).toEqual([SyncOpStatus.CONFLICT]);
  });
});

describe('écriture conditionnelle sur la révision', () => {
  it('un baseRev périmé produit un conflit au lieu d’écraser', async () => {
    await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')], 'batch-1'));

    const stale: SyncOperationDto = {
      opId: opId(),
      seq: 0,
      entity: SyncEntity.REPRESENTANT,
      op: SyncOp.UPDATE,
      entityId: REP_A,
      clientUpdatedAt: '2026-08-10T11:00:00.000Z',
      baseRev: 99,
      data: { fullName: 'Écrasé', phone: '77 123 45 67' },
    };

    const result = await sync.push(alice, batch([stale], 'batch-2'));
    expect(statuses(result.body.results)).toEqual([SyncOpStatus.CONFLICT]);
    expect(result.body.results[0]?.errorCode).toBe('REV_CONFLICT');
    expect(db.representants.get(REP_A)?.fullName).not.toBe('Écrasé');
  });
});

describe('réponse du push', () => {
  it('rend un résultat par opération, dans l’ordre de la requête', async () => {
    const operations = [createRep(REP_A, '77 123 45 67', 0), createRep(REP_B, '76 555 44 33', 1)];
    const result = await sync.push(alice, batch(operations));

    expect(result.body.results.map((row) => row.opId)).toEqual(operations.map((row) => row.opId));
    expect(result.body.batchId).toBe('batch-1');
  });
});

describe('mode démonstration allumé, la remontée hors ligne reste du travail RÉEL', () => {
  let demoDb: FakePrisma;
  let demoSync: SyncService;

  beforeEach(() => {
    demoDb = new FakePrisma();
    const prisma = demoDb as unknown as PrismaService;
    demoSync = new SyncService(
      prisma,
      new SyncBatchStore(prisma),
      new Phase2SyncService(),
      fakeDemoVisibility(true),
    );
  });

  it('un représentant remonté n’est PAS marqué de démonstration', async () => {
    await demoSync.push(alice, batch([createRep(REP_A, '77 123 45 67')]));

    expect(demoDb.representants.get(REP_A)?.isDemo ?? false).toBe(false);
  });

  it('un prospect remonté n’est PAS marqué de démonstration', async () => {
    const prospectId = '0198f000-0000-7000-8000-000000000001';
    await demoSync.push(
      alice,
      batch([
        createRep(REP_A, '77 123 45 67', 0),
        createProspect(prospectId, REP_A, '78 222 33 44', 1),
      ]),
    );

    expect(demoDb.prospects.get(prospectId)?.isDemo ?? false).toBe(false);
  });
});

describe('la remontée d’un COMPTE de démonstration écrit du fictif', () => {
  const animateur: AuthenticatedUser = { ...alice, id: 'demo-awa', username: 'demo.awa' };
  const PROSPECT = '0198f000-0000-7000-8000-000000000009';

  beforeEach(() => {
    db.addDemoUser(animateur.id);
  });

  it('LE REPRÉSENTANT SAISI PAR L’ANIMATEUR EST FICTIF', async () => {
    await sync.push(animateur, batch([createRep(REP_A, '77 123 45 67')]));

    expect(db.representants.get(REP_A)?.isDemo).toBe(true);
  });

  it('et il est INSCRIT AU REGISTRE, sans quoi la purge resterait bloquée', async () => {
    await sync.push(animateur, batch([createRep(REP_A, '77 123 45 67')]));

    expect(db.demoEntities).toContainEqual(
      expect.objectContaining({ entityType: 'representant', entityId: REP_A }),
    );
  });

  it('le prospect suit, et part du registre AVANT son représentant', async () => {
    await sync.push(
      animateur,
      batch([
        createRep(REP_A, '77 123 45 67', 0),
        createProspect(PROSPECT, REP_A, '78 222 33 44', 1),
      ]),
    );

    expect(db.prospects.get(PROSPECT)?.isDemo).toBe(true);

    const rang = (entityId: string): number =>
      db.demoEntities.find((row) => row.entityId === entityId)?.sequence ?? -1;
    expect(rang(PROSPECT)).toBeGreaterThan(rang(REP_A));
  });

  it('UN VRAI COMMERCIAL rattaché à un représentant FICTIF écrit du fictif', async () => {
    await sync.push(animateur, batch([createRep(REP_A, '77 123 45 67')]));

    const admin: AuthenticatedUser = { ...alice, id: 'com-admin', role: Role.ADMIN };
    await sync.push(admin, batch([createProspect(PROSPECT, REP_A, '78 222 33 44', 0)]));

    expect(db.prospects.get(PROSPECT)?.isDemo).toBe(true);
  });

  it('un compte RÉEL sur un représentant RÉEL n’écrit rien de fictif', async () => {
    await sync.push(
      alice,
      batch([
        createRep(REP_B, '77 999 88 77', 0),
        createProspect(PROSPECT, REP_B, '78 222 33 44', 1),
      ]),
    );

    expect(db.representants.get(REP_B)?.isDemo ?? false).toBe(false);
    expect(db.prospects.get(PROSPECT)?.isDemo ?? false).toBe(false);
    expect(db.demoEntities).toHaveLength(0);
  });
});

describe('autorité d’un lot', () => {
  const basculerApresLePremierGroupe = (mute: () => void): void => {
    const original = db.$transaction;
    let groupes = 0;
    db.$transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => {
      const outcome = await original(fn);
      groupes += 1;
      if (groupes === 1) mute();
      return outcome;
    };
  };

  const deuxGroupes = (): SyncPushDto =>
    batch([createRep(REP_A, '+221770000001', 0), createRep(REP_B, '+221770000002', 1)], opId());

  it('LES DEUX GROUPES ÉCRIVENT LA MÊME NATURE, même si l’auteur bascule au milieu', async () => {
    db.addUser('com-alice', { role: Role.COMMERCIAL, isDemo: false });
    basculerApresLePremierGroupe(() => {
      db.addUser('com-alice', { role: Role.COMMERCIAL, isDemo: true });
    });

    await sync.push(alice, deuxGroupes());

    expect(db.transactionCount).toBeGreaterThanOrEqual(2);
    const natures = [...db.representants.values()].map((row) => row.isDemo);
    expect(natures).toHaveLength(2);
    expect(new Set(natures).size).toBe(1);
    expect(natures[0]).toBe(false);
  });

  it('l’autorité est lue EN BASE, une seule fois, et non reprise du jeton', async () => {
    let lectures = 0;
    const original = db.user.findUnique;
    db.user.findUnique = (args: { where: { id: string } }) => {
      lectures += 1;
      return original(args);
    };
    db.addUser('com-alice', { role: Role.COMMERCIAL, isDemo: true });

    await sync.push(alice, deuxGroupes());

    expect(lectures).toBe(1);
    expect([...db.representants.values()].every((row) => row.isDemo)).toBe(true);
  });
});

describe('champs vidés', () => {
  const REP_ID = REP_A;
  const IEF = '0198f000-0000-7000-8000-000000000001';

  const creerAvecIef = async (): Promise<void> => {
    const creation = createRep(REP_ID, '+221770000001', 0);
    creation.data = Object.assign(creation.data ?? {}, { iefId: IEF });
    await sync.push(alice, batch([creation]));
    expect(db.representants.get(REP_ID)?.iefId).toBe(IEF);
  };

  const modifier = (extra: Partial<SyncOperationDto>): SyncOperationDto => ({
    opId: opId(),
    seq: 1,
    entity: SyncEntity.REPRESENTANT,
    op: SyncOp.UPDATE,
    entityId: REP_ID,
    clientUpdatedAt: '2026-08-10T11:00:00.000Z',
    baseRev: 1,
    data: {
      fullName: 'Rep A',
      phone: '+221770000001',
      departementId: '0198c000-0000-7000-8000-000000000001',
    },
    ...extra,
  });

  it('un champ ABSENT reste inchangé, et c’est ce qui protège les vieux clients', async () => {
    await creerAvecIef();

    await sync.push(alice, batch([modifier({})], 'batch-2'));

    expect(db.representants.get(REP_ID)?.iefId).toBe(IEF);
  });

  it('un champ NOMMÉ dans clearedFields est vidé pour de bon', async () => {
    await creerAvecIef();

    await sync.push(alice, batch([modifier({ clearedFields: ['iefId'] })], 'batch-3'));

    expect(db.representants.get(REP_ID)?.iefId).toBeNull();
  });
});
