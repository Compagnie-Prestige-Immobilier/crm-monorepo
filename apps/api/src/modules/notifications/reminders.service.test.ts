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

/**
 * Rappels programmés.
 *
 * Le cœur de ces tests est l'IDEMPOTENCE. Un rappel se déclenche seul, la nuit,
 * sans personne pour constater qu'il est parti deux fois, c'est exactement le
 * genre de défaut qu'on ne découvre qu'après avoir réveillé quarante personnes.
 */

const NOW = new Date('2026-08-13T08:00:00Z');

let db: FakePrisma;
let brevo: FakeBrevoTransport;
let reminders: RemindersService;

/** Reconstruit le service sur la MÊME base : c'est la simulation d'un redémarrage. */
const restart = (): RemindersService => {
  const notifications = new NotificationsService(db.asService(), fakeDemoVisibility(), brevo);
  return new RemindersService(db.asService(), notifications, fakeDemoVisibility());
};

beforeEach(() => {
  db = new FakePrisma();
  brevo = new FakeBrevoTransport();
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
    // du même matin comme appartenant à deux jours différents, et le rappel
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

  // Régression : le rappel n'interrogeait QUE `callTask`. Les campagnes
  // représentants, dont l'en-tête de module affirme qu'elles se comportent
  // comme celles de la phase 2, ne produisaient donc jamais de relance : un
  // téléconseiller pouvait laisser dormir cent représentants à rappeler sans
  // qu'aucun signal ne parte, et le silence ressemblait à « rien à faire ».
  it('relance aussi les campagnes REPRÉSENTANTS, sur leur propre écran', async () => {
    db.addRepCallTask({ assignedToId: 'usr-1' });
    db.addRepCallTask({ assignedToId: 'usr-1' });

    const run = await reminders.remindOpenRepCallTasks(NOW);

    expect(run.created).toBe(1);
    expect(db.notifications[0]?.body).toContain('2 représentant(s)');
    expect(db.notifications[0]?.route).toBe('/rep-campaigns');
  });

  // Deux clés d'idempotence distinctes, et non un compte fusionné : les deux
  // files sont deux métiers, elles renvoient vers deux écrans, et l'une doit
  // pouvoir être relancée sans l'autre.
  it('les deux files donnent DEUX rappels, jamais un compte fusionné', async () => {
    db.addCallTask({ assignedToId: 'usr-1' });
    db.addRepCallTask({ assignedToId: 'usr-1' });

    await reminders.remindOpenCallTasks(NOW);
    await reminders.remindOpenRepCallTasks(NOW);

    expect(db.notifications).toHaveLength(2);
    expect(db.notifications.map((row) => row.route).sort()).toEqual(['/phase2', '/rep-campaigns']);
    // Aucune des deux ne compte les tâches de l'autre.
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

// ─────────────────────────────────────────────────────────────────────────────
// Dossiers bancaires
// ─────────────────────────────────────────────────────────────────────────────

describe('rappels du pôle banque et financement', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-banque-1', role: Role.BANQUE_FINANCE, fullName: 'Fatou Ndiaye' });
    db.addUser({ id: 'usr-banque-2', role: Role.BANQUE_FINANCE, fullName: 'Ibrahima Fall' });
    // Un commercial, qui ne doit RIEN recevoir de ces deux familles.
    db.addUser({ id: 'usr-commercial', role: Role.COMMERCIAL, fullName: 'Awa Diop' });
  });

  describe('« dossiers en attente »', () => {
    it('compte les dossiers ouverts au-delà du délai, et prévient tout le pôle', async () => {
      db.addBankCase({ createdAt: new Date('2026-08-01T08:00:00Z') });
      db.addBankCase({ createdAt: new Date('2026-08-02T08:00:00Z') });
      // Déposé avant-hier : il est dans le délai de traitement normal.
      db.addBankCase({ createdAt: new Date('2026-08-11T08:00:00Z') });

      const run = await reminders.remindBankCasesPending(NOW);

      // Le compte est GLOBAL : un dossier bancaire n'a pas de propriétaire,
      // c'est le pôle entier qui le fait avancer.
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
      // Jamais bougé depuis juillet : c'est exactement le cas visé.
      db.addBankCase({ createdAt: new Date('2026-07-01T08:00:00Z'), lastTransitionAt: null });
      // Ancien lui aussi, mais avancé il y a trois jours.
      db.addBankCase({
        createdAt: new Date('2026-07-01T08:00:00Z'),
        lastTransitionAt: new Date('2026-08-10T08:00:00Z'),
      });
      // Créé hier : sans transition, forcément. L'y compter noierait le signal
      // sous les entrées du jour.
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

// ─────────────────────────────────────────────────────────────────────────────
// Idempotence, la propriété centrale
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
    // mémoire, il disparaît précisément au redémarrage, mais la contrainte
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
    // Le piège symétrique de l'idempotence : sans ce rattrapage, la personne
    // dont l'e-mail a buté sur un 429 voit sa notification écrite, la
    // contrainte unique interdire toute seconde écriture, et donc PLUS AUCUNE
    // tentative avant le lendemain. Un incident réseau de trente secondes
    // coûterait une journée de rappel.
    db.addUser({ id: 'usr-tc', role: Role.COMMERCIAL, email: 'tc@cpi.sn', fullName: 'Awa Diop' });
    db.addCallTask({ assignedToId: 'usr-tc' });

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

    refuse = false;
    const second = await reminders.remindOpenCallTasks(NOW);

    // Toujours AUCUNE notification supplémentaire : c'est l'envoi existant qui
    // est rejoué, pas un second qui est composé.
    expect(second.created).toBe(0);
    expect(db.notifications).toHaveLength(2);
    expect(db.deliveries.find((row) => row.userId === 'usr-tc')?.status).toBe(
      NotificationDeliveryStatus.SENT,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tick des envois programmés
// ─────────────────────────────────────────────────────────────────────────────

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
    // Le verrou est un `updateMany` conditionné sur `status = SCHEDULED` :
    // une comparaison-et-échange atomique, pas une lecture suivie d'une
    // écriture.
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

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * LA FENÊTRE DE PANNE
   * ═════════════════════════════════════════════════════════════════════════
   *
   * Le service qu'on branche ici prend la notification en charge par le VRAI
   * chemin (`dispatchDue` exécute son `updateMany`), puis n'expédie jamais :
   * `dispatch` rend une promesse qui ne se résout pas, et on abandonne le
   * passage sans l'attendre. C'est ce que fait un `SIGKILL` reçu entre la prise
   * en charge et l'envoi : l'écriture est validée, la suite n'arrive pas.
   *
   * On ne pose donc AUCUN état à la main, et on n'appelle aucune reprise
   * directement. L'état `SENDING` orphelin est produit par le code de
   * production lui-même, ce qui est la seule façon de prouver que le passage
   * suivant le rattrape vraiment.
   *
   * L'horloge de la doublure est calée sur `NOW` : `updatedAt`, qui date le
   * bail, et l'instant passé au tick doivent appartenir à la MÊME échelle de
   * temps, sans quoi la comparaison ne veut rien dire.
   */
  const PENDANT_LE_BAIL = new Date(NOW.getTime() + 60_000);
  const APRES_LE_BAIL = new Date(NOW.getTime() + SENDING_LEASE_MS + 60_000);

  const mourirEnPleineExpedition = async (): Promise<void> => {
    db.clock = () => NOW;

    let entre!: () => void;
    const dansLaFenetre = new Promise<void>((resolve) => {
      entre = resolve;
    });

    const moribond = new RemindersService(
      db.asService(),
      {
        dispatch: () => {
          entre();
          return new Promise<never>(() => {
            /* le processus meurt ici : cette promesse ne se résout jamais */
          });
        },
      } as unknown as NotificationsService,
      fakeDemoVisibility(),
    );

    void moribond.dispatchDue(NOW);
    await dansLaFenetre;
  };

  it('rattrape une expédition abandonnée en SENDING, mais seulement après le bail', async () => {
    const id = await schedule(new Date('2026-08-13T07:00:00Z'));
    await mourirEnPleineExpedition();

    // La prise en charge a bien eu lieu, et rien n'est parti : c'est
    // exactement la ligne que plus aucun passage ne relisait.
    expect(db.notifications.find((row) => row.id === id)?.status).toBe(NotificationStatus.SENDING);
    expect(brevo.sent).toHaveLength(0);

    // AVANT l'expiration, on ne reprend pas. Reprendre une expédition qui
    // tourne encore ferait repartir les e-mails déjà confiés à Brevo.
    db.clock = () => PENDANT_LE_BAIL;
    expect(await restart().dispatchDue(PENDANT_LE_BAIL)).toBe(0);
    expect(brevo.sent).toHaveLength(0);

    // APRÈS, la ligne redevient prenable et part pour de bon.
    db.clock = () => APRES_LE_BAIL;
    expect(await restart().dispatchDue(APRES_LE_BAIL)).toBe(1);
    expect(brevo.sent).toHaveLength(1);
    expect(db.notifications.find((row) => row.id === id)?.status).toBe(NotificationStatus.SENT);
  });

  it('DEUX INSTANCES ne reprennent qu’une fois un bail expiré', async () => {
    await schedule(new Date('2026-08-13T07:00:00Z'));
    await mourirEnPleineExpedition();

    // Le prédicat sur `updatedAt` est réévalué DANS l'`updateMany`, et
    // `@updatedAt` renouvelle le bail au passage : le second repreneur retrouve
    // une date fraîche et repart avec 0 ligne. Sans ce renouvellement, la
    // reprise transformerait une notification perdue en deux envois.
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

  /**
   * Le rattrapage doit couvrir les lignes que `dispatchDue` n'a PAS écrites.
   *
   * Un rappel sort de `emit()` : il naît `SENDING` sans `scheduledFor`, et
   * `emit()` l'expédie dans la foulée. Un processus tué à cet instant laisse
   * donc exactement le même orphelin, sauf qu'aucune date d'échéance ne le
   * décrit. `retryStalled` ne le reprendra pas non plus : la livraison est
   * restée `error: null`, faute d'avoir eu le temps d'être marquée.
   *
   * Et le prochain balayage n'a lieu que le lendemain, où il buterait sur la
   * contrainte unique de la veille. Sans le bail, ce rappel est perdu pour sa
   * journée, c'est-à-dire pour de bon.
   */
  it('rattrape aussi un RAPPEL abandonné, qui n’a pourtant aucune échéance', async () => {
    db.clock = () => NOW;
    db.addCallTask({ assignedToId: 'usr-1' });
    db.addCallTask({ assignedToId: 'usr-1' });

    const moribond = new RemindersService(
      db.asService(),
      {
        dispatch: () =>
          new Promise<never>(() => {
            /* le processus meurt entre l'écriture du rappel et son envoi */
          }),
      } as unknown as NotificationsService,
      fakeDemoVisibility(),
    );
    void moribond.remindOpenCallTasks(NOW);
    // Laisse l'écriture du rappel se valider avant qu'on abandonne le passage.
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

// ─────────────────────────────────────────────────────────────────────────────
// Expédition plus longue que son propre bail
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UN BAIL QUE PERSONNE NE RENOUVELLE FAIT PASSER LE VIVANT POUR UN MORT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `dispatchDue` reprend une notification `SENDING` dont `updatedAt` a plus de
 * `SENDING_LEASE_MS`, sur le motif que son détenteur est mort. Rien n'écrivait
 * pourtant la notification PENDANT l'expédition : `persistVerdicts` touche les
 * livraisons, et `settleNotification` n'écrit qu'à la toute fin. Une annonce
 * générale plus lente que le bail voyait donc `updatedAt` rester figé sur
 * l'instant de la prise, et un second passage la réclamait alors que le premier
 * envoyait encore. Les deux lisaient les mêmes livraisons `PENDING` et les
 * servaient toutes les deux.
 *
 * Le doc-bloc de `SENDING_LEASE_MS` traitait cette borne comme un PLANCHER
 * suffisant (« quinze minutes couvrent l'expédition la plus lente qui soit
 * légitime »). Ce n'est pas une propriété, c'est une estimation, et elle
 * dépend d'un service tiers : Brevo en 429 sur chaque vague, ou une base lente,
 * la dépassent sans que rien ne soit anormal. Un bail se RENOUVELLE, il ne
 * s'estime pas.
 */
describe('expédition plus longue que le bail', () => {
  /** Deux vagues : le renouvellement a lieu entre les deux. */
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

    /** Ce que le SECOND passage a réussi à reprendre pendant que le premier envoyait. */
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
          // La première vague a duré plus que le bail. C'est le cas que la
          // borne de quinze minutes suppose impossible, et qu'un service tiers
          // en 429 produit sans rien casser par ailleurs.
          db.clock = () => APRES_LE_BAIL;
        }

        if (this.calls === 2) {
          // Un autre passage tique pendant que la seconde vague est EN VOL.
          // Sans renouvellement du bail, il trouve `updatedAt` figé sur
          // l'instant de la prise, réclame la notification, relit les
          // livraisons encore `PENDING` et renvoie les mêmes e-mails.
          //
          // Il porte le MÊME transport, comme une seconde instance derrière le
          // même répartiteur : c'est ce qui rend le doublon visible ici plutôt
          // que dans une doublure que personne ne regarde.
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

    // LE POINT DU TEST : le second passage repart les mains vides.
    expect(repris).toBe(0);

    // Et la propriété qui compte pour le destinataire : une adresse, un e-mail.
    expect(lent.servies).toHaveLength(TOTAL);
    expect(new Set(lent.servies).size).toBe(TOTAL);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Visibilité de démonstration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT CORRIGÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les rappels LISAIENT sous l'interrupteur : ils comptaient les fiches et
 * résolvaient les destinataires sous `demoScope(mode)`. Comme la garde de
 * lecture seule ne juge que des requêtes HTTP et qu'une tâche planifiée n'en est
 * pas une, mode allumé le balayage comptait des fiches FICTIVES au profit d'un
 * VRAI commercial, et adressait de vraies relances à des comptes d'exemple.
 *
 * Ce qu'ils ne faisaient PAS, contrairement à ce qui a déjà été affirmé ici :
 * écrire `isDemo: mode`. La version fautive ne posait pas `isDemo` du tout, la
 * colonne prenait son défaut `false`. Aucune relance fictive n'a donc jamais été
 * écrite, et il n'y a pas de population héritée à rattraper. Le défaut était
 * dans la LECTURE, et là seulement.
 *
 * La règle est donc sans condition : les rappels comptent du réel et écrivent du
 * réel, `isDemo: false` étant désormais posé explicitement plutôt que laissé au
 * défaut de colonne. Ces tests-ci en épinglent les conséquences, dont celle qui
 * fait la promesse à l'utilisateur : ce qui est dû est reçu, même émis pendant
 * une démonstration.
 *
 * L'expédition des envois PROGRAMMÉS est le seul endroit du fichier qui suit
 * encore l'interrupteur, et pour la raison inverse : elle n'invente rien, elle
 * expédie des lignes composées ailleurs, dont une annonce d'exemple qui ne doit
 * pas partir pour de bon.
 */
describe('visibilité de démonstration', () => {
  /** Même base, mais un service dont l'interrupteur est ALLUMÉ. */
  const enDemonstration = (): RemindersService => {
    const notifications = new NotificationsService(db.asService(), fakeDemoVisibility(true), brevo);
    return new RemindersService(db.asService(), notifications, fakeDemoVisibility(true));
  };

  /** La boîte de réception d'une personne, MODE ÉTEINT : ce qu'elle voit vraiment. */
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

  /**
   * LA PROMESSE FAITE À L'UTILISATEUR, en un seul test.
   *
   * Un vrai commercial, de vraies fiches à appeler, et un administrateur qui a
   * laissé le mode allumé pendant le tick de 8 h. Le rappel lui est dû : il
   * doit partir, et il doit TOUJOURS être là quand l'interrupteur retombe.
   */
  it('mode ALLUMÉ : le rappel dû à un vrai commercial reste dans sa boîte une fois le mode ÉTEINT', async () => {
    db.addCallTask({ assignedToId: 'usr-1' });

    const run = await enDemonstration().remindOpenCallTasks(NOW);

    expect(run.created).toBe(1);
    expect(db.notifications.map((row) => row.isDemo)).toEqual([false]);
    expect(db.deliveries.map((row) => row.isDemo)).toEqual([false]);

    // Le mode est éteint : la relance est TOUJOURS visible, c'est tout l'objet.
    const boite = await boiteModeEteint('usr-1');
    expect(boite.items).toHaveLength(1);
    expect(boite.items[0]?.body).toContain('1 fiche(s)');
    expect(boite.unreadCount).toBe(1);
  });

  /**
   * Les fiches FICTIVES ne sont dues à personne.
   *
   * Les compter gonflerait le chiffre annoncé à un vrai commercial de fiches
   * qu'il ne verra jamais, et l'enverrait sur un écran qui en montre moins.
   */
  it('mode ALLUMÉ : le décompte ignore les fiches de démonstration', async () => {
    db.addCallTask({ assignedToId: 'usr-1' });
    db.addCallTask({ assignedToId: 'usr-1', isDemo: true });
    db.addCallTask({ assignedToId: 'usr-1', isDemo: true });

    await enDemonstration().remindOpenCallTasks(NOW);

    expect(db.notifications).toHaveLength(1);
    expect(db.notifications[0]?.body).toContain('1 fiche(s)');
  });

  /**
   * Un compte de démonstration n'a rien à recevoir.
   *
   * `demo.awa@cpi.sn` est une adresse d'exemple, mais elle part par Brevo comme
   * une autre : sur le vrai quota, et vers une boîte que personne ne relève.
   *
   * Les tâches sont RÉELLES ici, et l'attributaire fictif : c'est la seule
   * façon d'éprouver la résolution des destinataires SEULE. Avec des tâches
   * fictives, le décompte les écarterait d'abord et le test passerait au vert
   * même si le public cessait d'être cloisonné.
   */
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

  // Le rappel « sans mouvement » compte sa propre population : elle est
  // cloisonnée pour elle-même, et non parce que la précédente l'est.
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

  /**
   * ═══ L'INTERACTION AVEC LA CLÉ D'IDEMPOTENCE ═══
   *
   * `(reminderKey, period)` NE PORTE PAS `isDemo` : la place prise dans l'index
   * l'est pour la journée entière, quelle que soit la nature de la ligne qui
   * l'occupe. Une relance écrite fictive à 8 h condamnait donc le vrai rappel du
   * jour, même une fois le mode éteint à 9 h : le second passage se heurtait à
   * la clé, et le rattrapage, cherchant sous la portée du moment, ne retrouvait
   * même plus la ligne bloquée.
   *
   * Écrire toujours du réel referme la question, et ce test le vérifie DES DEUX
   * CÔTÉS de l'interrupteur : pas de doublon, et la relance qui occupe la clé
   * est celle que la personne voit.
   */
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

  /**
   * Le rattrapage d'un échec passager TRAVERSE l'extinction du mode.
   *
   * Le pire enchaînement possible, et il n'a rien d'improbable : le tick de 8 h
   * tombe pendant une démonstration, Brevo répond 429, l'administrateur éteint
   * le mode à 9 h. Quand la relance naissait fictive, le rattrapage la cherchait
   * sous la portée du moment et ne la retrouvait plus : la ligne restait
   * `PENDING` pour la journée, sans que rien ne le signale. Écrite réelle, elle
   * est retrouvée et rejouée.
   */
  it('un échec passager survenu PENDANT la démonstration est réessayé après l’extinction', async () => {
    db.addUser({ id: 'usr-tc', role: Role.COMMERCIAL, email: 'tc@cpi.sn', fullName: 'Modou Sarr' });
    db.addCallTask({ assignedToId: 'usr-tc' });

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
    const second = await reminders.remindOpenCallTasks(new Date('2026-08-13T09:00:00Z'));

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

    // Elle est MASQUÉE, pas perdue : le mode rallumé, elle repart.
    expect(await enDemonstration().dispatchDue(NOW)).toBe(1);
  });
});
