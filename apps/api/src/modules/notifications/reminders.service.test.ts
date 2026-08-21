import { BankStageType, NotificationDeliveryStatus, NotificationStatus, Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DELIVERY_RETRY_ERROR,
  EMAIL_PERSIST_GROUP_SIZE,
  NotificationsService,
} from './notifications.service.js';
import type { BrevoDispatchResult, BrevoMessage, BrevoTransport } from './brevo.transport.js';
import {
  RemindersService,
  ReminderKey,
  SENDING_LEASE_MS,
  periodFor,
  remindersCron,
} from './reminders.service.js';
import { FakeActivity, FakeBrevoTransport, FakePrisma } from './fake-prisma.js';
import { fakeWorkspace } from '../../workspaces/fake-workspace.js';

const NOW = new Date('2026-08-13T08:00:00Z');

let db: FakePrisma;
let brevo: FakeBrevoTransport;
let activite: FakeActivity;
let reminders: RemindersService;

const restart = (): RemindersService => {
  const notifications = new NotificationsService(db.asService(), fakeWorkspace(), brevo);
  return new RemindersService(db.asService(), notifications, activite.asService());
};

beforeEach(() => {
  db = new FakePrisma();
  brevo = new FakeBrevoTransport();
  activite = new FakeActivity();
  reminders = restart();
});

describe('découpage en périodes', () => {
  it('découpe par journée civile dans le fuseau métier', () => {
    expect(periodFor(new Date('2026-08-13T08:00:00Z'), 'Africa/Dakar')).toBe('2026-08-13');
  });

  it('deux instants du même matin à Dakar tombent dans la MÊME période', () => {
    const early = periodFor(new Date('2026-08-13T00:30:00Z'), 'Africa/Dakar');
    const later = periodFor(new Date('2026-08-13T23:30:00Z'), 'Africa/Dakar');
    expect(early).toBe(later);
  });

  it('construit l’expression cron depuis l’heure configurée', () => {
    expect(remindersCron('08:00')).toBe('0 00 08 * * *');
    expect(remindersCron('19:45')).toBe('0 45 19 * * *');
  });
});

describe('rappel « appels en attente »', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1', fullName: 'Awa Diop' });
    db.addUser({ id: 'usr-2', fullName: 'Modou Sarr' });
  });

  it('compte les tâches ouvertes d’une campagne ACTIVE', async () => {
    db.addCallTask({ assignedToId: 'usr-1' });
    db.addCallTask({ assignedToId: 'usr-1' });
    db.addCallTask({ assignedToId: 'usr-1' });

    const run = await reminders.remindOpenCallTasks(NOW);

    expect(run.created).toBe(1);
    expect(db.notifications[0]?.body).toContain('3 fiche(s)');
    expect(db.notifications[0]?.route).toBe('/phase2');
  });

  it('ignore les tâches d’une campagne close', async () => {
    db.addCallTask({ assignedToId: 'usr-1', campaignStatus: 'CLOSED' });
    expect((await reminders.remindOpenCallTasks(NOW)).created).toBe(0);
  });

  it('relance aussi les campagnes REPRÉSENTANTS, sur leur propre écran', async () => {
    db.addRepCallTask({ assignedToId: 'usr-1' });
    db.addRepCallTask({ assignedToId: 'usr-1' });

    const run = await reminders.remindOpenRepCallTasks(NOW);

    expect(run.created).toBe(1);
    expect(db.notifications[0]?.body).toContain('2 représentant(s)');
    expect(db.notifications[0]?.route).toBe('/rep-campaigns');
  });

  it('les deux files donnent DEUX rappels, jamais un compte fusionné', async () => {
    db.addCallTask({ assignedToId: 'usr-1' });
    db.addRepCallTask({ assignedToId: 'usr-1' });

    await reminders.remindOpenCallTasks(NOW);
    await reminders.remindOpenRepCallTasks(NOW);

    expect(db.notifications).toHaveLength(2);
    expect(db.notifications.map((row) => row.route).sort()).toEqual(['/phase2', '/rep-campaigns']);
    expect(db.notifications.every((row) => row.body.includes('1 '))).toBe(true);
  });

  it('les campagnes représentants closes ne relancent pas non plus', async () => {
    db.addRepCallTask({ assignedToId: 'usr-1', campaignStatus: 'CLOSED' });
    expect((await reminders.remindOpenRepCallTasks(NOW)).created).toBe(0);
  });

  it('ignore les tâches déjà faites ou désactivées', async () => {
    db.addCallTask({ assignedToId: 'usr-1', status: 'DONE' });
    db.addCallTask({ assignedToId: 'usr-1', isActive: false });
    expect((await reminders.remindOpenCallTasks(NOW)).created).toBe(0);
  });

  it('ignore un commercial désactivé entre-temps', async () => {
    db.addUser({ id: 'usr-parti', isActive: false });
    db.addCallTask({ assignedToId: 'usr-parti' });
    expect((await reminders.remindOpenCallTasks(NOW)).created).toBe(0);
  });

  it('un rappel par personne, chacun avec SON compte', async () => {
    db.addCallTask({ assignedToId: 'usr-1' });
    db.addCallTask({ assignedToId: 'usr-2' });
    db.addCallTask({ assignedToId: 'usr-2' });

    await reminders.remindOpenCallTasks(NOW);

    expect(db.notifications).toHaveLength(2);
    const bodies = db.notifications.map((row) => row.body);
    expect(bodies.some((body) => body.includes('1 fiche(s)'))).toBe(true);
    expect(bodies.some((body) => body.includes('2 fiche(s)'))).toBe(true);
  });
});

describe('rappels du pôle banque et financement', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-banque-1', role: Role.BANQUE_FINANCE, fullName: 'Fatou Ndiaye' });
    db.addUser({ id: 'usr-banque-2', role: Role.BANQUE_FINANCE, fullName: 'Ibrahima Fall' });
    db.addUser({ id: 'usr-commercial', role: Role.COMMERCIAL, fullName: 'Awa Diop' });
  });

  describe('« dossiers en attente »', () => {
    it('compte les dossiers ouverts au-delà du délai, et prévient tout le pôle', async () => {
      db.addBankCase({ createdAt: new Date('2026-08-01T08:00:00Z') });
      db.addBankCase({ createdAt: new Date('2026-08-02T08:00:00Z') });
      db.addBankCase({ createdAt: new Date('2026-08-11T08:00:00Z') });

      const run = await reminders.remindBankCasesPending(NOW);

      expect(run.created).toBe(2);
      expect(db.notifications).toHaveLength(2);
      expect(db.notifications[0]?.body).toContain('2 dossier(s)');
      expect(db.notifications[0]?.route).toBe('/dossiers');
      expect(db.notifications[0]?.body).not.toContain('{{');
    });

    it('ignore les étapes terminales et les dossiers supprimés', async () => {
      db.addBankCase({
        createdAt: new Date('2026-08-01T08:00:00Z'),
        stageType: BankStageType.CASHED,
      });
      db.addBankCase({
        createdAt: new Date('2026-08-01T08:00:00Z'),
        stageType: BankStageType.REJECTED,
      });
      db.addBankCase({
        createdAt: new Date('2026-08-01T08:00:00Z'),
        deletedAt: new Date('2026-08-05T08:00:00Z'),
      });

      expect((await reminders.remindBankCasesPending(NOW)).created).toBe(0);
      expect(db.notifications).toHaveLength(0);
    });

    it('ne dérange personne quand rien ne traîne', async () => {
      expect((await reminders.remindBankCasesPending(NOW)).created).toBe(0);
    });

    it('ne vise QUE le rôle banque et financement', async () => {
      db.addBankCase({ createdAt: new Date('2026-08-01T08:00:00Z') });

      await reminders.remindBankCasesPending(NOW);

      expect(db.deliveries.map((row) => row.userId).sort()).toEqual([
        'usr-banque-1',
        'usr-banque-2',
      ]);
    });

    it('ignore un compte du pôle désactivé entre-temps', async () => {
      db.addUser({ id: 'usr-parti', role: Role.BANQUE_FINANCE, isActive: false });
      db.addBankCase({ createdAt: new Date('2026-08-01T08:00:00Z') });

      await reminders.remindBankCasesPending(NOW);

      expect(db.deliveries.some((row) => row.userId === 'usr-parti')).toBe(false);
    });
  });

  describe('« dossiers sans mouvement »', () => {
    it('ne retient que les dossiers qu’aucune transition récente n’a touchés', async () => {
      db.addBankCase({ createdAt: new Date('2026-07-01T08:00:00Z'), lastTransitionAt: null });
      db.addBankCase({
        createdAt: new Date('2026-07-01T08:00:00Z'),
        lastTransitionAt: new Date('2026-08-10T08:00:00Z'),
      });
      db.addBankCase({ createdAt: new Date('2026-08-12T08:00:00Z'), lastTransitionAt: null });

      const run = await reminders.remindBankCasesStale(NOW);

      expect(run.created).toBe(2);
      expect(db.notifications[0]?.body).toContain('1 dossier(s)');
      expect(db.notifications[0]?.route).toBe('/dossiers');
    });

    it('n’émet rien quand tout bouge', async () => {
      db.addBankCase({
        createdAt: new Date('2026-07-01T08:00:00Z'),
        lastTransitionAt: new Date('2026-08-12T08:00:00Z'),
      });

      expect((await reminders.remindBankCasesStale(NOW)).created).toBe(0);
    });
  });

  describe('idempotence des rappels bancaires', () => {
    beforeEach(() => {
      db.addBankCase({ createdAt: new Date('2026-07-01T08:00:00Z'), lastTransitionAt: null });
    });

    it('deux passages dans la même période n’envoient QU’UNE fois', async () => {
      const first = await reminders.remindBankCasesPending(NOW);
      const second = await reminders.remindBankCasesPending(NOW);

      expect(first.created).toBe(2);
      expect(second.created).toBe(0);
      expect(second.skipped).toBe(2);
      expect(db.deliveries).toHaveLength(2);
    });

    it('UN REDÉMARRAGE NE RENVOIE PAS le rappel « sans mouvement »', async () => {
      await reminders.remindBankCasesStale(NOW);

      const afterRestart = restart();
      const run = await afterRestart.remindBankCasesStale(new Date('2026-08-13T08:02:00Z'));

      expect(run.created).toBe(0);
      expect(run.skipped).toBe(2);
      expect(db.notifications).toHaveLength(2);
    });

    it('les deux familles bancaires ne se bloquent PAS l’une l’autre', async () => {
      const pending = await reminders.remindBankCasesPending(NOW);
      const stale = await reminders.remindBankCasesStale(NOW);

      expect(pending.created).toBe(2);
      expect(stale.created).toBe(2);
    });

    it('la clé de livraison porte la famille, l’utilisateur et la période', async () => {
      await reminders.remindBankCasesPending(NOW);

      const delivery = db.deliveries[0];
      expect(delivery?.reminderKey).toBe(ReminderKey.BANK_CASES_PENDING);
      expect(delivery?.period).toBe('2026-08-13');
    });
  });
});

describe('idempotence par période', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1', fullName: 'Awa Diop' });
    db.addCallTask({ assignedToId: 'usr-1' });
  });

  it('deux exécutions dans la même période n’envoient QU’UNE fois', async () => {
    const first = await reminders.remindOpenCallTasks(NOW);
    const second = await reminders.remindOpenCallTasks(NOW);

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);
    expect(db.deliveries).toHaveLength(1);
  });

  it('UN REDÉMARRAGE NE RENVOIE PAS', async () => {
    await reminders.remindOpenCallTasks(NOW);

    const afterRestart = restart();
    const run = await afterRestart.remindOpenCallTasks(new Date('2026-08-13T08:02:00Z'));

    expect(run.created).toBe(0);
    expect(run.skipped).toBe(1);
    expect(db.notifications).toHaveLength(1);
  });

  it('DEUX INSTANCES CONCURRENTES n’envoient qu’une fois', async () => {
    const a = restart();
    const b = restart();

    const [first, second] = await Promise.all([
      a.remindOpenCallTasks(NOW),
      b.remindOpenCallTasks(NOW),
    ]);

    expect(first.created + second.created).toBe(1);
    expect(db.deliveries).toHaveLength(1);
  });

  it('la période SUIVANTE renvoie, le rappel reste un rappel', async () => {
    await reminders.remindOpenCallTasks(NOW);
    const nextDay = await reminders.remindOpenCallTasks(new Date('2026-08-14T08:00:00Z'));

    expect(nextDay.created).toBe(1);
    expect(db.notifications).toHaveLength(2);
  });

  it('deux familles de rappel ne se bloquent PAS l’une l’autre', async () => {
    db.addUser({ id: 'usr-banque', role: Role.BANQUE_FINANCE, fullName: 'Fatou Ndiaye' });
    db.addBankCase({ createdAt: new Date('2026-08-01T08:00:00Z') });

    const tasks = await reminders.remindOpenCallTasks(NOW);
    const bank = await reminders.remindBankCasesPending(NOW);

    expect(tasks.created).toBe(1);
    expect(bank.created).toBe(1);
  });

  it('la clé de livraison est bien (famille, utilisateur, période)', async () => {
    await reminders.remindOpenCallTasks(NOW);

    const delivery = db.deliveries[0];
    expect(delivery?.reminderKey).toBe(ReminderKey.OPEN_CALL_TASKS);
    expect(delivery?.userId).toBe('usr-1');
    expect(delivery?.period).toBe('2026-08-13');
  });

  it('UN ÉCHEC PASSAGER EST RÉESSAYÉ DANS LA MÊME PÉRIODE', async () => {
    db.addUser({ id: 'usr-tc', role: Role.COMMERCIAL, email: 'tc@cpi.sn', fullName: 'Awa Diop' });
    db.addCallTask({ assignedToId: 'usr-tc' });
    db.clock = () => NOW;

    let refuse = true;
    brevo = new FakeBrevoTransport((email) =>
      refuse ? { email, ok: false, errorCode: 'HTTP_429', kind: 'transient' } : { email, ok: true },
    );
    brevo.configured = true;
    reminders = restart();

    const first = await reminders.remindOpenCallTasks(NOW);
    expect(first.created).toBe(2);
    const stalled = db.deliveries.find((row) => row.userId === 'usr-tc');
    expect(stalled?.status).toBe(NotificationDeliveryStatus.PENDING);
    expect(stalled?.error).toBe(DELIVERY_RETRY_ERROR);

    const APRES_LE_BAIL = new Date(NOW.getTime() + SENDING_LEASE_MS + 60_000);
    db.clock = () => APRES_LE_BAIL;
    refuse = false;
    const second = await reminders.remindOpenCallTasks(APRES_LE_BAIL);

    expect(second.created).toBe(0);
    expect(db.notifications).toHaveLength(2);
    expect(db.deliveries.find((row) => row.userId === 'usr-tc')?.status).toBe(
      NotificationDeliveryStatus.SENT,
    );
  });
});

describe('expédition des envois programmés', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1', role: Role.COMMERCIAL, email: 'un@cpi.sn' });
    brevo.configured = true;
  });

  const schedule = async (at: Date): Promise<string> => {
    const row = await db.notification.create({
      data: {
        title: 'Programmée',
        body: 'Corps',
        status: NotificationStatus.SCHEDULED,
        scheduledFor: at,
        deliveries: { createMany: { data: [{ userId: 'usr-1' }] } },
      },
    });
    return row.id;
  };

  it('expédie ce qui est dû, et rien d’autre', async () => {
    await schedule(new Date('2026-08-13T07:00:00Z'));
    await schedule(new Date('2026-08-14T07:00:00Z'));

    expect(await reminders.dispatchDue(NOW)).toBe(1);
    expect(brevo.sent).toHaveLength(1);
  });

  it('DEUX INSTANCES ne l’expédient qu’une fois', async () => {
    await schedule(new Date('2026-08-13T07:00:00Z'));

    const a = restart();
    const b = restart();
    const [first, second] = await Promise.all([a.dispatchDue(NOW), b.dispatchDue(NOW)]);

    expect(first + second).toBe(1);
    expect(brevo.sent).toHaveLength(1);
  });

  it('ne touche pas une notification annulée entre-temps', async () => {
    const id = await schedule(new Date('2026-08-13T07:00:00Z'));
    await db.notification.updateMany({
      where: { id, status: NotificationStatus.SCHEDULED },
      data: { status: NotificationStatus.CANCELLED },
    });

    expect(await reminders.dispatchDue(NOW)).toBe(0);
    expect(brevo.sent).toHaveLength(0);
  });

  const PENDANT_LE_BAIL = new Date(NOW.getTime() + 60_000);
  const APRES_LE_BAIL = new Date(NOW.getTime() + SENDING_LEASE_MS + 60_000);

  const mourirEnPleineExpedition = async (): Promise<void> => {
    db.clock = () => NOW;

    let entre!: () => void;
    const dansLaFenetre = new Promise<void>((resolve) => {
      entre = resolve;
    });

    const fige: BrevoTransport = {
      isConfigured: () => true,
      unavailableReason: () => null,
      send: () => {
        entre();
        return new Promise<never>(() => {});
      },
    };

    const moribond = new RemindersService(
      db.asService(),
      new NotificationsService(db.asService(), fakeWorkspace(), fige),
      activite.asService(),
    );

    void moribond.dispatchDue(NOW);
    await dansLaFenetre;
  };

  it('rattrape une expédition abandonnée en SENDING, mais seulement après le bail', async () => {
    const id = await schedule(new Date('2026-08-13T07:00:00Z'));
    await mourirEnPleineExpedition();

    expect(db.notifications.find((row) => row.id === id)?.status).toBe(NotificationStatus.SENDING);
    expect(brevo.sent).toHaveLength(0);

    db.clock = () => PENDANT_LE_BAIL;
    expect(await restart().dispatchDue(PENDANT_LE_BAIL)).toBe(0);
    expect(brevo.sent).toHaveLength(0);

    db.clock = () => APRES_LE_BAIL;
    expect(await restart().dispatchDue(APRES_LE_BAIL)).toBe(1);
    expect(brevo.sent).toHaveLength(1);
    expect(db.notifications.find((row) => row.id === id)?.status).toBe(NotificationStatus.SENT);
  });

  it('DEUX INSTANCES ne reprennent qu’une fois un bail expiré', async () => {
    await schedule(new Date('2026-08-13T07:00:00Z'));
    await mourirEnPleineExpedition();

    db.clock = () => APRES_LE_BAIL;
    const a = restart();
    const b = restart();
    const [premier, second] = await Promise.all([
      a.dispatchDue(APRES_LE_BAIL),
      b.dispatchDue(APRES_LE_BAIL),
    ]);

    expect(premier + second).toBe(1);
    expect(brevo.sent).toHaveLength(1);
  });

  it('rattrape aussi un RAPPEL abandonné, qui n’a pourtant aucune échéance', async () => {
    db.clock = () => NOW;
    db.addCallTask({ assignedToId: 'usr-1' });
    db.addCallTask({ assignedToId: 'usr-1' });

    const moribond = new RemindersService(
      db.asService(),
      {
        dispatch: () => new Promise<never>(() => {}),
      } as unknown as NotificationsService,
      activite.asService(),
    );
    void moribond.remindOpenCallTasks(NOW);
    await vi.waitUntil(() => db.notifications.length === 1);

    const rappel = db.notifications[0];
    expect(rappel?.status).toBe(NotificationStatus.SENDING);
    expect(rappel?.scheduledFor).toBeNull();
    expect(rappel?.reminderKey).toBe(`${ReminderKey.OPEN_CALL_TASKS}:usr-1`);
    expect(brevo.sent).toHaveLength(0);

    db.clock = () => APRES_LE_BAIL;
    expect(await restart().dispatchDue(APRES_LE_BAIL)).toBe(1);

    expect(brevo.allAddresses).toEqual(['un@cpi.sn']);
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.SENT);
  });
});

describe('expédition plus longue que le bail', () => {
  const TOTAL = EMAIL_PERSIST_GROUP_SIZE + 8;
  const APRES_LE_BAIL = new Date(NOW.getTime() + SENDING_LEASE_MS + 60_000);

  beforeEach(() => {
    db.clock = () => NOW;
    brevo.configured = true;
    for (let index = 0; index < TOTAL; index += 1) {
      const suffix = String(index);
      db.addUser({ id: `usr-${suffix}`, role: Role.COMMERCIAL, email: `${suffix}@cpi.sn` });
    }
  });

  it('N’EST PAS REPRISE PAR UN SECOND PASSAGE, et personne n’est servi deux fois', async () => {
    await db.notification.create({
      data: {
        title: 'Annonce générale',
        body: 'Corps',
        status: NotificationStatus.SCHEDULED,
        scheduledFor: new Date(NOW.getTime() - 60_000),
        deliveries: {
          createMany: {
            data: Array.from({ length: TOTAL }, (_unused, index) => ({
              userId: `usr-${String(index)}`,
            })),
          },
        },
      },
    });

    let repris: number | null = null;

    const lent = new (class implements BrevoTransport {
      calls = 0;
      readonly servies: string[] = [];

      isConfigured(): boolean {
        return true;
      }

      unavailableReason(): string | null {
        return null;
      }

      async send(messages: readonly BrevoMessage[]): Promise<BrevoDispatchResult> {
        this.calls += 1;
        const adresses = messages.flatMap((message) =>
          message.recipients.map((recipient) => recipient.email),
        );

        if (this.calls === 1) {
          db.clock = () => APRES_LE_BAIL;
        }

        if (this.calls === 2) {
          repris = await new RemindersService(
            db.asService(),
            new NotificationsService(db.asService(), fakeWorkspace(), this),
            activite.asService(),
          ).dispatchDue(APRES_LE_BAIL);
        }

        this.servies.push(...adresses);
        return {
          status: 'SENT',
          outcomes: adresses.map((email) => ({ email, ok: true })),
        };
      }
    })();

    const notifications = new NotificationsService(db.asService(), fakeWorkspace(), lent);
    const service = new RemindersService(db.asService(), notifications, activite.asService());

    expect(await service.dispatchDue(NOW)).toBe(1);

    expect(repris).toBe(0);

    expect(lent.servies).toHaveLength(TOTAL);
    expect(new Set(lent.servies).size).toBe(TOTAL);
  });
});

describe('réessai d’un rappel et tick d’échéance qui se croisent', () => {
  const APRES_LE_BAIL = new Date(NOW.getTime() + SENDING_LEASE_MS + 60_000);

  class TransportCroise implements BrevoTransport {
    readonly servies: string[] = [];
    refuse = true;
    pendantLEnvoi: (() => Promise<unknown>) | null = null;

    isConfigured(): boolean {
      return true;
    }

    unavailableReason(): string | null {
      return null;
    }

    async send(messages: readonly BrevoMessage[]): Promise<BrevoDispatchResult> {
      const adresses = messages.flatMap((message) =>
        message.recipients.map((recipient) => recipient.email),
      );

      if (this.refuse) {
        return {
          status: 'TRANSPORT_ERROR',
          outcomes: adresses.map((email) => ({
            email,
            ok: false as const,
            errorCode: 'HTTP_429',
            kind: 'transient' as const,
          })),
          detail: 'HTTP_429',
        };
      }

      const concurrent = this.pendantLEnvoi;
      this.pendantLEnvoi = null;
      if (concurrent) await concurrent();

      this.servies.push(...adresses);
      return { status: 'SENT', outcomes: adresses.map((email) => ({ email, ok: true })) };
    }
  }

  it('NE SERVENT PAS LA MÊME LIVRAISON DEUX FOIS', async () => {
    db.addUser({ id: 'usr-tc', role: Role.COMMERCIAL, email: 'tc@cpi.sn', fullName: 'Awa Diop' });
    db.addCallTask({ assignedToId: 'usr-tc' });
    db.clock = () => NOW;

    const croise = new TransportCroise();
    const passage = (): RemindersService =>
      new RemindersService(
        db.asService(),
        new NotificationsService(db.asService(), fakeWorkspace(), croise),
        activite.asService(),
      );

    await passage().remindOpenCallTasks(NOW);
    const enFile = db.deliveries.find((row) => row.userId === 'usr-tc');
    expect(enFile?.status).toBe(NotificationDeliveryStatus.PENDING);
    expect(enFile?.error).toBe(DELIVERY_RETRY_ERROR);
    expect(croise.servies).toHaveLength(0);

    db.clock = () => APRES_LE_BAIL;
    croise.refuse = false;
    croise.pendantLEnvoi = () => passage().dispatchDue(APRES_LE_BAIL);

    await passage().remindOpenCallTasks(APRES_LE_BAIL);

    expect(croise.servies).toEqual(['tc@cpi.sn']);
    expect(db.deliveries.find((row) => row.userId === 'usr-tc')?.status).toBe(
      NotificationDeliveryStatus.SENT,
    );
    const rappel = db.notifications.find((row) => row.reminderKey?.startsWith('open-call-tasks'));
    expect(rappel?.status).toBe(NotificationStatus.SENT);
    expect(rappel?.dispatchClaim).toBeNull();
  });
});

describe('rappel « rappels à passer »', () => {
  const AUJOURDHUI = new Date('2026-08-13T16:00:00.000Z');
  const HIER = new Date('2026-08-12T16:00:00.000Z');
  const DEMAIN = new Date('2026-08-14T09:00:00.000Z');

  beforeEach(() => {
    db.addUser({ id: 'usr-1', fullName: 'Awa Diop' });
    db.addUser({ id: 'usr-2', fullName: 'Modou Sarr' });
  });

  it('compte les rappels du jour de chaque téléconseiller, séparément', async () => {
    db.addScheduledCallback({ assignedToId: 'usr-1', scheduledAt: AUJOURDHUI });
    db.addScheduledCallback({ assignedToId: 'usr-1', scheduledAt: AUJOURDHUI });
    db.addScheduledCallback({ assignedToId: 'usr-2', scheduledAt: AUJOURDHUI });

    const run = await reminders.remindDueCallbacks(NOW);

    expect(run.created).toBe(2);
    expect(db.notifications[0]?.body).toContain('2 rappel(s)');
    expect(db.notifications[1]?.body).toContain('1 rappel(s)');
    expect(db.notifications[0]?.route).toBe('/phase2/callbacks');
  });

  it('un rappel EN RETARD compte dans la relance du jour', async () => {
    db.addScheduledCallback({ assignedToId: 'usr-1', scheduledAt: HIER });

    expect((await reminders.remindDueCallbacks(NOW)).created).toBe(1);
    expect(db.notifications[0]?.body).toContain('1 rappel(s)');
  });

  it('un rappel de demain ne relance personne aujourd’hui', async () => {
    db.addScheduledCallback({ assignedToId: 'usr-1', scheduledAt: DEMAIN });

    expect((await reminders.remindDueCallbacks(NOW)).created).toBe(0);
  });

  it('un rappel déjà passé ou annulé ne relance plus', async () => {
    db.addScheduledCallback({ assignedToId: 'usr-1', scheduledAt: HIER, status: 'DONE' });
    db.addScheduledCallback({ assignedToId: 'usr-1', scheduledAt: HIER, status: 'CANCELLED' });
    db.addScheduledCallback({ assignedToId: 'usr-1', scheduledAt: HIER, status: 'SUPERSEDED' });

    expect((await reminders.remindDueCallbacks(NOW)).created).toBe(0);
  });

  it('deux passages le même jour ne donnent qu’une relance', async () => {
    db.addScheduledCallback({ assignedToId: 'usr-1', scheduledAt: AUJOURDHUI });

    expect((await reminders.remindDueCallbacks(NOW)).created).toBe(1);
    expect((await reminders.remindDueCallbacks(NOW)).created).toBe(0);
    expect(db.notifications).toHaveLength(1);
  });

  it('la clé de rappel lui est propre, elle ne prend pas la place d’une autre', async () => {
    db.addScheduledCallback({ assignedToId: 'usr-1', scheduledAt: AUJOURDHUI });
    db.addCallTask({ assignedToId: 'usr-1' });

    await reminders.runAll(NOW);

    const cles = db.deliveries.map((delivery) => delivery.reminderKey);
    expect(cles).toContain(ReminderKey.DUE_CALLBACKS);
    expect(cles).toContain(ReminderKey.OPEN_CALL_TASKS);
  });
});

describe('compte rendu de fin de journée', () => {
  const SOIR = new Date('2026-08-13T17:00:00.000Z');

  beforeEach(() => {
    db.clock = () => SOIR;
    db.addUser({ id: 'usr-sup', fullName: 'Fatou Ndiaye', role: Role.SUPERVISEUR });
    db.addUser({ id: 'usr-tc', fullName: 'Awa Diop', role: Role.COMMERCIAL });
    activite.addTeleconseiller({ id: 'usr-tc', fullName: 'Awa Diop' });
  });

  it('demande les chiffres de la journée en cours, dans le fuseau métier', async () => {
    await reminders.sendDailyReport(new Date('2026-08-13T23:30:00.000Z'));

    expect(activite.windows).toEqual([{ from: '2026-08-13', to: '2026-08-13' }]);
  });

  it('additionne les actes de tous les téléconseillers', async () => {
    activite.addRow({ teleconseillerId: 'usr-tc', calls: 30, methodObtained: 4, unreachable: 9 });
    activite.addRow({
      teleconseillerId: 'usr-2',
      calls: 12,
      methodObtained: 1,
      prospectsCreated: 3,
    });

    await reminders.sendDailyReport(SOIR);

    const corps = db.notifications[0]?.body ?? '';
    expect(corps).toContain('42 appel(s)');
    expect(corps).toContain('5 méthode(s)');
    expect(corps).toContain('9 NRP');
    expect(corps).toContain('3 prospect(s)');
  });

  it('compte les rappels honorés dans la journée et ceux qui traînent', async () => {
    db.addScheduledCallback({
      assignedToId: 'usr-tc',
      scheduledAt: new Date('2026-08-13T10:00:00.000Z'),
      updatedAt: new Date('2026-08-13T11:00:00.000Z'),
      status: 'DONE',
    });
    // Promis hier, honoré ce matin : c'est la journée de l'ACTE qui compte.
    db.addScheduledCallback({
      assignedToId: 'usr-tc',
      scheduledAt: new Date('2026-08-12T10:00:00.000Z'),
      updatedAt: new Date('2026-08-13T08:00:00.000Z'),
      status: 'DONE',
    });
    db.addScheduledCallback({
      assignedToId: 'usr-tc',
      scheduledAt: new Date('2026-08-12T10:00:00.000Z'),
      updatedAt: new Date('2026-08-12T11:00:00.000Z'),
      status: 'DONE',
    });
    db.addScheduledCallback({
      assignedToId: 'usr-tc',
      scheduledAt: new Date('2026-08-13T09:00:00.000Z'),
    });
    db.addScheduledCallback({
      assignedToId: 'usr-tc',
      scheduledAt: new Date('2026-08-14T09:00:00.000Z'),
    });

    await reminders.sendDailyReport(SOIR);

    const corps = db.notifications[0]?.body ?? '';
    expect(corps).toContain('2 honoré(s)');
    expect(corps).toContain('1 en retard');
  });

  it('nomme le téléconseiller qui n’a rien fait de la journée', async () => {
    activite.addTeleconseiller({ id: 'usr-2', fullName: 'Modou Sarr' });
    activite.addRow({ teleconseillerId: 'usr-tc', calls: 5 });

    await reminders.sendDailyReport(SOIR);

    const corps = db.notifications[0]?.body ?? '';
    expect(corps).toContain('Modou Sarr');
    expect(corps).not.toContain('Awa Diop');
  });

  it('ne compte pas comme muet un compte désactivé', async () => {
    activite.addTeleconseiller({ id: 'usr-2', fullName: 'Modou Sarr', isActive: false });

    await reminders.sendDailyReport(SOIR);

    expect(db.notifications[0]?.body).not.toContain('Modou Sarr');
  });

  it('s’adresse à l’administration et à la supervision, jamais aux téléconseillers', async () => {
    const run = await reminders.sendDailyReport(SOIR);

    expect(run.created).toBe(2);
    expect(new Set(db.deliveries.map((row) => row.userId))).toEqual(
      new Set(['usr-admin', 'usr-sup']),
    );
  });

  it('deux passages le même soir ne donnent qu’un compte rendu', async () => {
    expect((await reminders.sendDailyReport(SOIR)).created).toBe(2);
    expect((await reminders.sendDailyReport(SOIR)).created).toBe(0);
    expect(db.notifications).toHaveLength(2);
  });
});
