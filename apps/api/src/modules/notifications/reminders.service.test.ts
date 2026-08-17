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
import { FakeBrevoTransport, FakePrisma } from './fake-prisma.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

const NOW = new Date('2026-08-13T08:00:00Z');

let db: FakePrisma;
let brevo: FakeBrevoTransport;
let reminders: RemindersService;

const restart = (): RemindersService => {
  const notifications = new NotificationsService(db.asService(), fakeDemoVisibility(), brevo);
  return new RemindersService(db.asService(), notifications, fakeDemoVisibility());
};

beforeEach(() => {
  db = new FakePrisma();
  brevo = new FakeBrevoTransport();
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
      new NotificationsService(db.asService(), fakeDemoVisibility(), fige),
      fakeDemoVisibility(),
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
      fakeDemoVisibility(),
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
            new NotificationsService(db.asService(), fakeDemoVisibility(), this),
            fakeDemoVisibility(),
          ).dispatchDue(APRES_LE_BAIL);
        }

        this.servies.push(...adresses);
        return {
          status: 'SENT',
          outcomes: adresses.map((email) => ({ email, ok: true })),
        };
      }
    })();

    const notifications = new NotificationsService(db.asService(), fakeDemoVisibility(), lent);
    const service = new RemindersService(db.asService(), notifications, fakeDemoVisibility());

    expect(await service.dispatchDue(NOW)).toBe(1);

    expect(repris).toBe(0);

    expect(lent.servies).toHaveLength(TOTAL);
    expect(new Set(lent.servies).size).toBe(TOTAL);
  });
});

describe('visibilité de démonstration', () => {
  const enDemonstration = (): RemindersService => {
    const notifications = new NotificationsService(db.asService(), fakeDemoVisibility(true), brevo);
    return new RemindersService(db.asService(), notifications, fakeDemoVisibility(true));
  };

  const boiteModeEteint = async (userId: string) => {
    const notifications = new NotificationsService(db.asService(), fakeDemoVisibility(), brevo);
    return notifications.inbox(
      {
        id: userId,
        email: `${userId}@cpi.sn`,
        username: userId,
        fullName: userId,
        role: Role.COMMERCIAL,
      },
      {},
    );
  };

  beforeEach(() => {
    db.addUser({ id: 'usr-1', fullName: 'Awa Diop' });
  });

  it('mode ÉTEINT : la relance et sa livraison sont réelles', async () => {
    db.addCallTask({ assignedToId: 'usr-1' });

    await reminders.remindOpenCallTasks(NOW);

    expect(db.notifications.map((row) => row.isDemo)).toEqual([false]);
    expect(db.deliveries.map((row) => row.isDemo)).toEqual([false]);
  });

  it('mode ALLUMÉ : le rappel dû à un vrai commercial reste dans sa boîte une fois le mode ÉTEINT', async () => {
    db.addCallTask({ assignedToId: 'usr-1' });

    const run = await enDemonstration().remindOpenCallTasks(NOW);

    expect(run.created).toBe(1);
    expect(db.notifications.map((row) => row.isDemo)).toEqual([false]);
    expect(db.deliveries.map((row) => row.isDemo)).toEqual([false]);

    const boite = await boiteModeEteint('usr-1');
    expect(boite.items).toHaveLength(1);
    expect(boite.items[0]?.body).toContain('1 fiche(s)');
    expect(boite.unreadCount).toBe(1);
  });

  it('mode ALLUMÉ : le décompte ignore les fiches de démonstration', async () => {
    db.addCallTask({ assignedToId: 'usr-1' });
    db.addCallTask({ assignedToId: 'usr-1', isDemo: true });
    db.addCallTask({ assignedToId: 'usr-1', isDemo: true });

    await enDemonstration().remindOpenCallTasks(NOW);

    expect(db.notifications).toHaveLength(1);
    expect(db.notifications[0]?.body).toContain('1 fiche(s)');
  });

  it('mode ALLUMÉ : un commercial FICTIF ne reçoit aucun rappel', async () => {
    db.addUser({ id: 'usr-demo', fullName: 'Awa (démo)', isDemo: true });
    db.addCallTask({ assignedToId: 'usr-demo' });
    db.addCallTask({ assignedToId: 'usr-demo' });

    const run = await enDemonstration().remindOpenCallTasks(NOW);

    expect(run.created).toBe(0);
    expect(db.notifications).toHaveLength(0);
  });

  it('mode ALLUMÉ : les dossiers et les agents fictifs sortent aussi des rappels bancaires', async () => {
    db.addUser({ id: 'usr-banque', role: Role.BANQUE_FINANCE, fullName: 'Fatou Ndiaye' });
    db.addUser({
      id: 'usr-banque-demo',
      role: Role.BANQUE_FINANCE,
      fullName: 'Agent (démo)',
      isDemo: true,
    });
    db.addBankCase({ createdAt: new Date('2026-08-01T08:00:00Z') });
    db.addBankCase({ createdAt: new Date('2026-08-01T08:00:00Z'), isDemo: true });

    await enDemonstration().remindBankCasesPending(NOW);

    expect(db.deliveries.map((row) => row.userId)).toEqual(['usr-banque']);
    expect(db.notifications[0]?.body).toContain('1 dossier(s)');
    expect(db.notifications[0]?.isDemo).toBe(false);
  });

  it('mode ALLUMÉ : « sans mouvement » ne compte pas les dossiers fictifs', async () => {
    db.addUser({ id: 'usr-banque', role: Role.BANQUE_FINANCE, fullName: 'Fatou Ndiaye' });
    db.addBankCase({ createdAt: new Date('2026-07-01T08:00:00Z'), lastTransitionAt: null });
    db.addBankCase({
      createdAt: new Date('2026-07-01T08:00:00Z'),
      lastTransitionAt: null,
      isDemo: true,
    });

    await enDemonstration().remindBankCasesStale(NOW);

    expect(db.notifications[0]?.body).toContain('1 dossier(s)');
  });

  it('la clé du jour est occupée par la VRAIE relance, des deux côtés de l’interrupteur', async () => {
    db.addCallTask({ assignedToId: 'usr-1' });

    const pendant = await enDemonstration().remindOpenCallTasks(NOW);
    const apres = await reminders.remindOpenCallTasks(new Date('2026-08-13T09:00:00Z'));

    expect(pendant.created).toBe(1);
    expect(apres.created).toBe(0);
    expect(apres.skipped).toBe(1);
    expect(db.notifications).toHaveLength(1);
    expect((await boiteModeEteint('usr-1')).items).toHaveLength(1);
  });

  it('un échec passager survenu PENDANT la démonstration est réessayé après l’extinction', async () => {
    db.addUser({ id: 'usr-tc', role: Role.COMMERCIAL, email: 'tc@cpi.sn', fullName: 'Modou Sarr' });
    db.addCallTask({ assignedToId: 'usr-tc' });
    db.clock = () => NOW;

    let refuse = true;
    brevo = new FakeBrevoTransport((email) =>
      refuse ? { email, ok: false, errorCode: 'HTTP_429', kind: 'transient' } : { email, ok: true },
    );
    brevo.configured = true;
    reminders = restart();

    await enDemonstration().remindOpenCallTasks(NOW);
    const stalled = db.deliveries.find((row) => row.userId === 'usr-tc');
    expect(stalled?.status).toBe(NotificationDeliveryStatus.PENDING);
    expect(stalled?.error).toBe(DELIVERY_RETRY_ERROR);

    refuse = false;
    const uneHeurePlusTard = new Date('2026-08-13T09:00:00Z');
    db.clock = () => uneHeurePlusTard;
    const second = await reminders.remindOpenCallTasks(uneHeurePlusTard);

    expect(second.created).toBe(0);
    expect(db.deliveries.find((row) => row.userId === 'usr-tc')?.status).toBe(
      NotificationDeliveryStatus.SENT,
    );
  });

  it('n’expédie PAS un envoi programmé de démonstration quand le mode est éteint', async () => {
    await db.notification.create({
      data: {
        title: 'Annonce de démonstration',
        body: 'Corps',
        status: NotificationStatus.SCHEDULED,
        scheduledFor: new Date('2026-08-13T07:00:00Z'),
        isDemo: true,
        deliveries: { createMany: { data: [{ userId: 'usr-1', isDemo: true }] } },
      },
    });

    expect(await reminders.dispatchDue(NOW)).toBe(0);
    expect(brevo.sent).toHaveLength(0);

    expect(await enDemonstration().dispatchDue(NOW)).toBe(1);
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
        new NotificationsService(db.asService(), fakeDemoVisibility(), croise),
        fakeDemoVisibility(),
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
