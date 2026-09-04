process.env.NOTIFICATIONS_REMINDERS_ENABLED ??= 'true';

import { Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationsService } from './notifications.service.js';
import type { SupervisionActivityService } from '../analytics/supervision.service.js';
import { FakePrisma, type DetectionRow } from './fake-prisma.js';
import { RemindersService, trancheDe } from './reminders.service.js';

const ALICE = 'com-alice';
const SUPERVISEUR = 'sup-1';
const DIRECTION = 'dir-1';

const DETECTION = 'det-1';
const APPEL = new Date('2026-08-10T14:05:00.000Z');

let db: FakePrisma;
let dispatched: string[][];
let service: RemindersService;

const detection = (overrides: Partial<DetectionRow> = {}): DetectionRow => ({
  id: DETECTION,
  performedById: ALICE,
  attemptId: null,
  deviceCallType: 'sortant',
  deviceCallAt: APPEL,
  performedBy: { fullName: 'Alice Diop' },
  representant: { fullName: 'Ndeye Sow' },
  prospect: null,
  ...overrides,
});

beforeEach(() => {
  db = new FakePrisma();
  db.addUser({ id: ALICE, fullName: 'Alice Diop', role: Role.COMMERCIAL });
  db.addUser({ id: SUPERVISEUR, role: Role.SUPERVISEUR });
  db.addUser({ id: DIRECTION, role: Role.DIRECTION });
  db.deviceCallDetections.push(detection());

  dispatched = [];
  const notifications = {
    dispatchMany: vi.fn((ids: string[]) => {
      dispatched.push(ids);
      return Promise.resolve(new Map());
    }),
  } as unknown as NotificationsService;

  service = new RemindersService(
    db.asService(),
    notifications,
    {} as unknown as SupervisionActivityService,
  );
});

describe('alerte des appels non consignés', () => {
  it('nomme le téléconseiller, la fiche et l’heure, et vise l’encadrement', async () => {
    expect(await service.alerterAppelsNonConsignes(ALICE, [DETECTION])).toBe(1);

    const envoi = db.notifications[0];
    expect(envoi?.title).toBe('Appel non consigné');
    expect(envoi?.body).toBe('Alice Diop : appel sortant avec Ndeye Sow à 14:05, non consigné.');
    expect(envoi?.route).toBe('/supervision?volet=activite');
    expect(envoi?.audienceUserIds).toEqual([SUPERVISEUR, DIRECTION]);
    expect(db.deliveries.map((row) => row.userId)).toEqual([SUPERVISEUR, DIRECTION]);
    expect(dispatched).toEqual([[envoi?.id]]);
  });

  it('n’envoie qu’une alerte par téléconseiller et par tranche de 30 minutes', async () => {
    const dans10min = new Date('2026-08-10T14:10:00.000Z');
    const dans40min = new Date('2026-08-10T14:40:00.000Z');

    expect(await service.alerterAppelsNonConsignes(ALICE, [DETECTION], APPEL)).toBe(1);
    expect(await service.alerterAppelsNonConsignes(ALICE, [DETECTION], dans10min)).toBe(0);
    expect(db.notifications).toHaveLength(1);

    expect(await service.alerterAppelsNonConsignes(ALICE, [DETECTION], dans40min)).toBe(1);
    expect(db.notifications).toHaveLength(2);
    expect(trancheDe(APPEL)).not.toBe(trancheDe(dans40min));
  });

  it('se tait pour un appel déjà consigné', async () => {
    db.deviceCallDetections[0] = detection({ attemptId: 'att-1' });

    expect(await service.alerterAppelsNonConsignes(ALICE, [DETECTION])).toBe(0);
    expect(db.notifications).toHaveLength(0);
  });

  it('se tait quand aucun compte d’encadrement n’est actif', async () => {
    db.users.splice(0, db.users.length, {
      id: ALICE,
      fullName: 'Alice Diop',
      role: Role.COMMERCIAL,
      email: 'alice@cpi.sn',
      isActive: true,
      deletedAt: null,
      departementId: null,
    });

    expect(await service.alerterAppelsNonConsignes(ALICE, [DETECTION])).toBe(0);
    expect(db.notifications).toHaveLength(0);
  });
});
