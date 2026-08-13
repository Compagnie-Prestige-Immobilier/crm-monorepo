import { NotificationStatus } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import { NotificationsService } from './notifications.service.js';
import { RemindersService, ReminderKey, periodFor, remindersCron } from './reminders.service.js';
import { FakePrisma, FakeTransport } from './fake-prisma.js';

/**
 * Rappels programmés.
 *
 * Le cœur de ces tests est l'IDEMPOTENCE. Un rappel se déclenche seul, la nuit,
 * sans personne pour constater qu'il est parti deux fois — c'est exactement le
 * genre de défaut qu'on ne découvre qu'après avoir réveillé quarante personnes.
 */

const NOW = new Date('2026-08-13T08:00:00Z');

let db: FakePrisma;
let transport: FakeTransport;
let reminders: RemindersService;

/** Reconstruit le service sur la MÊME base : c'est la simulation d'un redémarrage. */
const restart = (): RemindersService => {
  const notifications = new NotificationsService(db.asService(), transport);
  return new RemindersService(db.asService(), notifications);
};

beforeEach(() => {
  db = new FakePrisma();
  transport = new FakeTransport();
  reminders = restart();
});

// ─────────────────────────────────────────────────────────────────────────────
// Période
// ─────────────────────────────────────────────────────────────────────────────

describe('découpage en périodes', () => {
  it('découpe par journée civile dans le fuseau métier', () => {
    expect(periodFor(new Date('2026-08-13T08:00:00Z'), 'Africa/Dakar')).toBe('2026-08-13');
  });

  it('deux instants du même matin à Dakar tombent dans la MÊME période', () => {
    // Découper en UTC ferait, pour les ticks nocturnes, considérer deux envois
    // du même matin comme appartenant à deux jours différents — et le rappel
    // repartirait.
    const early = periodFor(new Date('2026-08-13T00:30:00Z'), 'Africa/Dakar');
    const later = periodFor(new Date('2026-08-13T23:30:00Z'), 'Africa/Dakar');
    expect(early).toBe(later);
  });

  it('construit l’expression cron depuis l’heure configurée', () => {
    expect(remindersCron('08:00')).toBe('0 00 08 * * *');
    expect(remindersCron('19:45')).toBe('0 45 19 * * *');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Saisies non synchronisées
// ─────────────────────────────────────────────────────────────────────────────

describe('rappel « saisies non synchronisées »', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-retard', fullName: 'Awa Diop' });
    db.addUser({ id: 'usr-a-jour', fullName: 'Modou Sarr' });

    // Sept jours de retard : bien au-delà du seuil de trois jours.
    db.addDevice({
      userId: 'usr-retard',
      token: 'tok-retard',
      pendingOps: 12,
      pendingSince: new Date('2026-08-06T08:00:00Z'),
    });
    db.addDevice({ userId: 'usr-a-jour', token: 'tok-a-jour', pendingOps: 0 });
  });

  it('ne vise que les appareils réellement en retard', async () => {
    const run = await reminders.remindUnsyncedEntries(NOW);

    expect(run.created).toBe(1);
    expect(db.notifications).toHaveLength(1);
    expect(db.deliveries[0]?.userId).toBe('usr-retard');
  });

  it('ne réveille pas un commercial dont la file est vide', async () => {
    // Le signal vient de l'APPAREIL, pas d'une déduction « n'a rien poussé
    // depuis N jours » qui confondrait un congé avec un téléphone en retard.
    db.deviceTokens.length = 0;
    db.addDevice({ userId: 'usr-a-jour', token: 'tok', pendingOps: 0 });

    expect((await reminders.remindUnsyncedEntries(NOW)).created).toBe(0);
  });

  it('ignore un retard plus récent que le seuil', async () => {
    db.deviceTokens.length = 0;
    db.addDevice({
      userId: 'usr-retard',
      token: 'tok',
      pendingOps: 3,
      pendingSince: new Date('2026-08-12T20:00:00Z'), // moins de 24 h
    });

    expect((await reminders.remindUnsyncedEntries(NOW)).created).toBe(0);
  });

  it('ignore un appareil révoqué', async () => {
    db.deviceTokens.length = 0;
    db.addDevice({
      userId: 'usr-retard',
      token: 'tok',
      pendingOps: 9,
      pendingSince: new Date('2026-08-01T08:00:00Z'),
      revokedAt: new Date('2026-08-11T08:00:00Z'),
    });

    expect((await reminders.remindUnsyncedEntries(NOW)).created).toBe(0);
  });

  it('personnalise le texte avec le compte réel', async () => {
    await reminders.remindUnsyncedEntries(NOW);
    expect(db.notifications[0]?.body).toContain('12 saisie(s)');
    expect(db.notifications[0]?.body).toContain('7 jour(s)');
    // Aucun marqueur `{{}}` ne doit survivre dans un texte expédié.
    expect(db.notifications[0]?.body).not.toContain('{{');
  });

  it('mène à l’écran de la file de synchronisation', async () => {
    await reminders.remindUnsyncedEntries(NOW);
    expect(db.notifications[0]?.route).toBe('/a-corriger');
  });

  it('retient l’appareil le plus en retard quand il y en a deux', async () => {
    db.addDevice({
      userId: 'usr-retard',
      token: 'tok-second',
      pendingOps: 40,
      pendingSince: new Date('2026-08-05T08:00:00Z'),
    });

    await reminders.remindUnsyncedEntries(NOW);
    expect(db.notifications[0]?.body).toContain('40 saisie(s)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tâches d'appel ouvertes
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Idempotence — la propriété centrale
// ─────────────────────────────────────────────────────────────────────────────

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
    // Le scénario réel : l'API tique à 8 h, est redéployée à 8 h 02, et la
    // nouvelle instance retique. La parade n'est pas un « j'ai déjà tourné » en
    // mémoire — il disparaît précisément au redémarrage — mais la contrainte
    // unique en base, qui survit à tout.
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

  it('la période SUIVANTE renvoie — le rappel reste un rappel', async () => {
    await reminders.remindOpenCallTasks(NOW);
    const nextDay = await reminders.remindOpenCallTasks(new Date('2026-08-14T08:00:00Z'));

    expect(nextDay.created).toBe(1);
    expect(db.notifications).toHaveLength(2);
  });

  it('deux familles de rappel ne se bloquent PAS l’une l’autre', async () => {
    db.addDevice({
      userId: 'usr-1',
      token: 'tok',
      pendingOps: 4,
      pendingSince: new Date('2026-08-01T08:00:00Z'),
    });

    const tasks = await reminders.remindOpenCallTasks(NOW);
    const unsynced = await reminders.remindUnsyncedEntries(NOW);

    expect(tasks.created).toBe(1);
    expect(unsynced.created).toBe(1);
  });

  it('la clé de livraison est bien (famille, utilisateur, période)', async () => {
    await reminders.remindOpenCallTasks(NOW);

    const delivery = db.deliveries[0];
    expect(delivery?.reminderKey).toBe(ReminderKey.OPEN_CALL_TASKS);
    expect(delivery?.userId).toBe('usr-1');
    expect(delivery?.period).toBe('2026-08-13');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tick des envois programmés
// ─────────────────────────────────────────────────────────────────────────────

describe('expédition des envois programmés', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1' });
    db.addDevice({ userId: 'usr-1', token: 'tok-1' });
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
    expect(transport.allMessages).toHaveLength(1);
  });

  it('DEUX INSTANCES ne l’expédient qu’une fois', async () => {
    // Le verrou est un `updateMany` conditionné sur `status = SCHEDULED` :
    // une comparaison-et-échange atomique, pas une lecture suivie d'une
    // écriture.
    await schedule(new Date('2026-08-13T07:00:00Z'));

    const a = restart();
    const b = restart();
    const [first, second] = await Promise.all([a.dispatchDue(NOW), b.dispatchDue(NOW)]);

    expect(first + second).toBe(1);
    expect(transport.allMessages).toHaveLength(1);
  });

  it('ne touche pas une notification annulée entre-temps', async () => {
    const id = await schedule(new Date('2026-08-13T07:00:00Z'));
    await db.notification.updateMany({
      where: { id, status: NotificationStatus.SCHEDULED },
      data: { status: NotificationStatus.CANCELLED },
    });

    expect(await reminders.dispatchDue(NOW)).toBe(0);
    expect(transport.allMessages).toHaveLength(0);
  });
});
