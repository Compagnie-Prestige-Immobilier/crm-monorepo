import { CallOutcome, Role } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Phase2SyncService } from '../phase2/phase2-sync.service.js';
import { VisitesService } from '../visites/visites.service.js';
import { SYSTEM_OUTCOME_REASONS } from '../referentiels/call-outcome-rules.js';
import { SyncBatchStore } from './batch-store.js';
import { SyncService } from './sync.service.js';
import { FakePrisma, type ProspectRow } from './fake-prisma.js';
import { SyncEntity, SyncOp, SyncOpStatus } from './dto.js';
import type { SyncOperationDto, SyncPushDto } from './dto.js';

const alice: AuthenticatedUser = {
  id: 'com-alice',
  email: 'alice@cpi.sn',
  username: 'alice',
  fullName: 'Alice Diop',
  role: Role.COMMERCIAL,
};

const PROSPECT_A = '0198f000-0000-7000-8000-000000000001';
const PROSPECT_B = '0198f000-0000-7000-8000-000000000002';

let db: FakePrisma;
let sync: SyncService;
let counter = 0;

const uuid = (): string => `0198b100-0000-7000-8000-${String(++counter).padStart(12, '0')}`;

const seedProspect = (id: string): void => {
  db.prospects.set(id, {
    id,
    nom: 'Fall',
    prenom: 'Moussa',
    phoneE164: '+221771000001',
    rev: 1,
    statut: 'NOUVEAU',
    phase2Status: 'PENDING',
    enrollmentMethod: null,
    enrollmentCapturedById: null,
    enrollmentCapturedAt: null,
    banqueId: 'banque-1',
    syndicatId: 'syndicat-1',
    representantId: 'rep-1',
    createdById: alice.id,
    clientCreatedAt: new Date('2026-08-10T10:00:00.000Z'),
    createdAt: new Date('2026-08-10T10:00:00.000Z'),
    updatedAt: new Date('2026-08-10T10:00:00.000Z'),
    deletedAt: null,
  } satisfies ProspectRow);
};

beforeEach(() => {
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm';
  process.env.NODE_ENV ??= 'test';

  db = new FakePrisma();
  db.addUser(alice.id, { role: Role.COMMERCIAL });
  for (const reason of SYSTEM_OUTCOME_REASONS) {
    db.callOutcomeReasons.set(reason.code, {
      id: `reason-${reason.code}`,
      code: reason.code,
      label: reason.label,
      effect: reason.effect,
      requiresComment: reason.requiresComment,
      requiresCallback: reason.requiresCallback,
      isActive: true,
    });
  }
  seedProspect(PROSPECT_A);
  seedProspect(PROSPECT_B);

  const prisma = db as unknown as PrismaService;
  sync = new SyncService(
    prisma,
    new SyncBatchStore(prisma),
    new Phase2SyncService(),
    new VisitesService(prisma),
  );
});

const attempt = (
  prospectId: string,
  data: Record<string, unknown> = {},
  seq = 0,
): SyncOperationDto => ({
  opId: uuid(),
  seq,
  entity: SyncEntity.CALL_ATTEMPT,
  op: SyncOp.CREATE,
  entityId: uuid(),
  clientUpdatedAt: '2026-08-10T10:00:00.000Z',
  data: {
    prospectId,
    outcome: CallOutcome.UNREACHABLE,
    clientCreatedAt: '2026-08-10T10:05:00.000Z',
    ...data,
  },
});

const push = (operations: SyncOperationDto[], id = 'lot-1'): SyncPushDto => ({
  clientBatchId: id,
  payloadVersion: 1,
  operations,
});

const statuses = (results: { status: SyncOpStatus }[]): SyncOpStatus[] =>
  results.map((result) => result.status);

describe('remontée d’une tentative avec un motif d’issue', () => {
  it('un lot de version 1, sans aucun reasonCode, passe entier', async () => {
    const result = await sync.push(
      alice,
      push([
        attempt(PROSPECT_A),
        attempt(PROSPECT_B, { outcome: CallOutcome.CALLBACK }, 1),
        attempt(PROSPECT_A, { outcome: CallOutcome.OTHER, comment: 'rappelle lundi' }, 2),
      ]),
    );

    expect(statuses(result.body.results)).toEqual([
      SyncOpStatus.APPLIED,
      SyncOpStatus.APPLIED,
      SyncOpStatus.APPLIED,
    ]);
    expect(db.callAttempts.size).toBe(3);
  });

  it('un lot sans reasonCode rattache quand même la tentative à son motif système', async () => {
    await sync.push(alice, push([attempt(PROSPECT_A, { outcome: CallOutcome.REFUSED })]));

    expect([...db.callAttempts.values()][0]?.reasonId).toBe('reason-REFUSED');
  });

  it('un reasonCode système donne exactement la même ligne que l’issue seule', async () => {
    await sync.push(alice, push([attempt(PROSPECT_A, { outcome: CallOutcome.REFUSED })], 'lot-a'));
    const implicite = [...db.callAttempts.values()][0];

    db.callAttempts.clear();
    // Le parcours porte désormais l'état de phase 2 : le réinitialiser aussi,
    // sinon la seconde tentative repart sur une fiche déjà soldée.
    db.prospectJourneys.clear();
    seedProspect(PROSPECT_A);
    await sync.push(
      alice,
      push(
        [attempt(PROSPECT_A, { outcome: CallOutcome.REFUSED, reasonCode: CallOutcome.REFUSED })],
        'lot-b',
      ),
    );
    const explicite = [...db.callAttempts.values()][0];

    expect(explicite?.reasonId).toBe(implicite?.reasonId);
    expect(explicite?.outcome).toBe(implicite?.outcome);
  });

  it('un code inconnu refuse SA SEULE opération, pas le lot', async () => {
    const result = await sync.push(
      alice,
      push([
        attempt(PROSPECT_A, { reasonCode: 'MOTIF_FANTOME' }),
        attempt(PROSPECT_A, {}, 1),
        attempt(PROSPECT_B, { outcome: CallOutcome.REFUSED }, 2),
      ]),
    );

    expect(statuses(result.body.results)).toEqual([
      SyncOpStatus.INVALID,
      SyncOpStatus.APPLIED,
      SyncOpStatus.APPLIED,
    ]);
    expect(result.body.results[0]?.errorCode).toBe('PHASE2_REASON_UNKNOWN');
    expect(db.callAttempts.size).toBe(2);
  });

  it('un motif retiré du référentiel refuse la seule opération qui l’invoque', async () => {
    db.callOutcomeReasons.set('BOITE_VOCALE', {
      id: 'reason-BOITE_VOCALE',
      code: 'BOITE_VOCALE',
      label: 'Boîte vocale',
      effect: 'KEEP_OPEN',
      requiresComment: false,
      requiresCallback: false,
      isActive: false,
    });

    const result = await sync.push(
      alice,
      push([attempt(PROSPECT_A, { reasonCode: 'BOITE_VOCALE' }), attempt(PROSPECT_B, {}, 1)]),
    );

    expect(statuses(result.body.results)).toEqual([SyncOpStatus.INVALID, SyncOpStatus.APPLIED]);
    expect(result.body.results[0]?.errorCode).toBe('PHASE2_REASON_INACTIVE');
  });

  it('un motif ajouté par l’administration s’écrit sur la tentative', async () => {
    db.callOutcomeReasons.set('BOITE_VOCALE', {
      id: 'reason-BOITE_VOCALE',
      code: 'BOITE_VOCALE',
      label: 'Boîte vocale',
      effect: 'KEEP_OPEN',
      requiresComment: true,
      requiresCallback: false,
      isActive: true,
    });

    const result = await sync.push(
      alice,
      push([
        attempt(PROSPECT_A, { reasonCode: 'BOITE_VOCALE' }),
        attempt(PROSPECT_B, { reasonCode: 'BOITE_VOCALE', comment: 'boîte saturée' }, 1),
      ]),
    );

    expect(statuses(result.body.results)).toEqual([SyncOpStatus.INVALID, SyncOpStatus.APPLIED]);
    expect(result.body.results[0]?.errorCode).toBe('PHASE2_COMMENT_REQUIRED');
    expect([...db.callAttempts.values()][0]?.reasonId).toBe('reason-BOITE_VOCALE');
  });
});

describe('à qui appartient la fiche appelée', () => {
  const PROSPECT_DE_BOB = '0198f000-0000-7000-8000-000000000003';

  const seedProspectDe = (id: string, createdById: string): void => {
    seedProspect(id);
    const row = db.prospects.get(id);
    if (row) row.createdById = createdById;
  };

  it('la fiche d’un collègue est refusée, pas appliquée', async () => {
    seedProspectDe(PROSPECT_DE_BOB, 'com-bob');

    const result = await sync.push(alice, push([attempt(PROSPECT_DE_BOB)]));

    expect(statuses(result.body.results)).toEqual([SyncOpStatus.CONFLICT]);
    expect(result.body.results[0]?.errorCode).toBe('ENTITY_ID_OWNED_BY_ANOTHER_USER');
    expect(db.callAttempts.size).toBe(0);
  });

  /// Le cas qui a motivé la porte : la campagne confie une fiche que le
  /// téléconseiller n'a pas saisie.
  it('la fiche d’un collègue CONFIÉE par une campagne passe', async () => {
    seedProspectDe(PROSPECT_DE_BOB, 'com-bob');
    db.callTasks.set('task-1', {
      id: 'task-1',
      prospectId: PROSPECT_DE_BOB,
      assignedToId: alice.id,
      isActive: true,
      status: 'OPEN',
      campaignId: 'camp-1',
      createdAt: new Date('2026-08-10T09:00:00.000Z'),
    });

    const result = await sync.push(alice, push([attempt(PROSPECT_DE_BOB)]));

    expect(statuses(result.body.results)).toEqual([SyncOpStatus.APPLIED]);
    expect(db.callAttempts.size).toBe(1);
  });

  /// Une tentative saisie hors ligne arrive souvent après que la file a été
  /// soldée : la tâche close reste une autorisation.
  it('une tâche déjà close autorise encore la remontée tardive', async () => {
    seedProspectDe(PROSPECT_DE_BOB, 'com-bob');
    db.callTasks.set('task-1', {
      id: 'task-1',
      prospectId: PROSPECT_DE_BOB,
      assignedToId: alice.id,
      isActive: false,
      status: 'DONE',
      campaignId: 'camp-1',
      createdAt: new Date('2026-08-10T09:00:00.000Z'),
    });

    const result = await sync.push(alice, push([attempt(PROSPECT_DE_BOB)]));

    expect(statuses(result.body.results)).toEqual([SyncOpStatus.APPLIED]);
  });
});
