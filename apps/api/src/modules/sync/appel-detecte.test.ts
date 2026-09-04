import { Role } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Phase2SyncService } from '../phase2/phase2-sync.service.js';
import { VisitesService } from '../visites/visites.service.js';
import { SyncBatchStore } from './batch-store.js';
import { SyncService } from './sync.service.js';
import { FakePrisma, fakeReminders } from './fake-prisma.js';
import { SyncEntity, SyncOp, SyncOpStatus, dependencyKeyOf } from './dto.js';
import type { SyncOperationDto, SyncPushDto } from './dto.js';

const alice: AuthenticatedUser = {
  id: 'com-alice',
  email: 'alice@cpi.sn',
  username: 'alice',
  fullName: 'Alice Diop',
  role: Role.COMMERCIAL,
};

const REP = '0198a000-0000-7000-8000-000000000001';
const PROSPECT = '0198a000-0000-7000-8000-000000000002';
const DETECTION = '0198f000-0000-7000-8000-000000000001';
const ATTEMPT = '0198b000-0000-7000-8000-000000000001';

const APPEL_A = '2026-08-10T10:00:00.000Z';

let db: FakePrisma;
let sync: SyncService;
let counter = 0;

const detecte = (data: Record<string, unknown>, entityId = DETECTION): SyncOperationDto => ({
  opId: `0198c000-0000-7000-8000-${String(++counter).padStart(12, '0')}`,
  seq: 0,
  entity: SyncEntity.APPEL_DETECTE,
  op: SyncOp.CREATE,
  entityId,
  clientUpdatedAt: APPEL_A,
  data: {
    representantId: REP,
    deviceCallType: 'sortant',
    deviceCallDurationSeconds: 42,
    deviceCallAt: APPEL_A,
    detectedAt: '2026-08-10T10:01:00.000Z',
    ...data,
  },
});

const push = (operations: SyncOperationDto[], id = `lot-${String(++counter)}`): SyncPushDto => ({
  clientBatchId: id,
  payloadVersion: 1,
  operations,
});

beforeEach(() => {
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm';
  process.env.NODE_ENV ??= 'test';

  db = new FakePrisma();
  db.addUser(alice.id, { role: Role.COMMERCIAL });
  // `lotItems` vide : la fiche n'est à personne d'autre que son créateur, ce
  // qui rend la portée d'attribution réellement lisible dans la doublure.
  db.representants.set(REP, {
    id: REP,
    fullName: 'Rep Un',
    phoneE164: '+221771234567',
    createdById: alice.id,
    lotItems: [],
    deletedAt: null,
  } as never);
  db.prospects.set(PROSPECT, {
    id: PROSPECT,
    nom: 'Fall',
    prenom: 'Moussa',
    phoneE164: '+221770000001',
    createdById: alice.id,
    deletedAt: null,
  } as never);

  const prisma = db as unknown as PrismaService;
  sync = new SyncService(
    prisma,
    new SyncBatchStore(prisma),
    new Phase2SyncService(),
    new VisitesService(prisma),
    fakeReminders(),
  );
});

describe('appel détecté par le journal du téléphone', () => {
  it('se pose sans tentative, et reste non consigné', async () => {
    const result = await sync.push(alice, push([detecte({})]));

    expect(result.body.results[0]?.status).toBe(SyncOpStatus.APPLIED);
    const row = db.deviceCallDetections.get(DETECTION);
    expect(row?.representantId).toBe(REP);
    expect(row?.attemptId).toBeNull();
    expect(row?.deviceCallDurationSeconds).toBe(42);
  });

  it('rejoué sous un autre lot, il ne s’écrit pas deux fois', async () => {
    await sync.push(alice, push([detecte({})], 'lot-1'));
    const rejeu = await sync.push(alice, push([detecte({})], 'lot-2'));

    expect(rejeu.body.results[0]?.status).toBe(SyncOpStatus.DUPLICATE);
    expect(db.deviceCallDetections.size).toBe(1);
  });

  // La tentative est saisie AVANT l'appel : seule l'heure du journal peut la
  // rapprocher de la détection.
  it('se rattache par l’heure du journal d’appels', async () => {
    db.repCallAttempts.set(ATTEMPT, {
      id: ATTEMPT,
      representantId: REP,
      performedById: alice.id,
      outcome: 'REACHED',
      deviceCallAt: new Date('2026-08-10T10:00:30.000Z'),
      clientCreatedAt: new Date('2026-08-10T09:59:00.000Z'),
    });

    await sync.push(alice, push([detecte({})]));

    expect(db.deviceCallDetections.get(DETECTION)?.attemptId).toBe(ATTEMPT);
  });

  // Le journal n'a rien donné à la tentative : reste la saisie, faite dans les
  // deux heures qui suivent l'appel.
  it('se rattache à une saisie faite dans les deux heures', async () => {
    db.repCallAttempts.set(ATTEMPT, {
      id: ATTEMPT,
      representantId: REP,
      performedById: alice.id,
      outcome: 'REACHED',
      deviceCallAt: null,
      clientCreatedAt: new Date('2026-08-10T11:30:00.000Z'),
    });

    await sync.push(alice, push([detecte({})]));

    expect(db.deviceCallDetections.get(DETECTION)?.attemptId).toBe(ATTEMPT);
  });

  it('ignore une tentative trop lointaine dans le temps', async () => {
    db.repCallAttempts.set(ATTEMPT, {
      id: ATTEMPT,
      representantId: REP,
      performedById: alice.id,
      outcome: 'REACHED',
      deviceCallAt: new Date('2026-08-10T13:00:00.000Z'),
      clientCreatedAt: new Date('2026-08-10T13:00:00.000Z'),
    });

    await sync.push(alice, push([detecte({})]));

    expect(db.deviceCallDetections.get(DETECTION)?.attemptId).toBeNull();
  });

  it('refuse une fiche hors du périmètre du téléconseiller', async () => {
    db.representants.set(REP, {
      id: REP,
      fullName: 'Rep Un',
      phoneE164: '+221771234567',
      createdById: 'com-bob',
      lotItems: [],
      deletedAt: null,
    } as never);

    const result = await sync.push(alice, push([detecte({})]));

    expect(result.body.results[0]?.status).toBe(SyncOpStatus.INVALID);
    expect(result.body.results[0]?.errorCode).toBe('APPEL_DETECTE_HORS_PERIMETRE');
    expect(db.deviceCallDetections.size).toBe(0);
  });

  // Un lot n'accepte que 25 groupes de dépendance : une partition par appel
  // détecté ferait refuser toute session d'appels un peu fournie.
  it('partage la partition de sa fiche, pas la sienne', () => {
    expect(dependencyKeyOf(detecte({}))).toBe(`representant:${REP}`);
    expect(dependencyKeyOf(detecte({ representantId: undefined, prospectId: PROSPECT }))).toBe(
      `prospect:${PROSPECT}`,
    );
  });

  it('refuse deux cibles, aucune cible, ou un type inconnu', async () => {
    const deux = await sync.push(alice, push([detecte({ prospectId: PROSPECT })]));
    expect(deux.body.results[0]?.errorCode).toBe('APPEL_DETECTE_INVALIDE');

    const aucune = await sync.push(
      alice,
      push([detecte({ representantId: undefined })], 'lot-aucune'),
    );
    expect(aucune.body.results[0]?.errorCode).toBe('APPEL_DETECTE_INVALIDE');

    const type = await sync.push(
      alice,
      push([detecte({ deviceCallType: 'fax' as never })], 'lot-type'),
    );
    expect(type.body.results[0]?.errorCode).toBe('APPEL_DETECTE_INVALIDE');

    expect(db.deviceCallDetections.size).toBe(0);
  });
});
