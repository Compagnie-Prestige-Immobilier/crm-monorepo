import {
  NotificationAudience,
  NotificationDeliveryStatus,
  NotificationStatus,
  Role,
} from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import {
  DELIVERY_ABANDONED,
  DELIVERY_INBOX_ONLY,
  DELIVERY_RETRY_ERROR,
  DISPATCH_DEADLINE_MS,
  EMAIL_PERSIST_GROUP_SIZE,
  NotificationsService,
  buildEmailContent,
} from './notifications.service.js';
import { NotificationError } from './errors.js';
import { SENDING_LEASE_MS } from './dispatch-claim.js';
import {
  BrokenBrevoTransport,
  FakeBrevoTransport,
  FakePrisma,
  ThrowingBrevoTransport,
} from './fake-prisma.js';
import {
  BREVO_MAX_CONCURRENT_CALLS,
  BrevoHttpTransport,
  chunkRecipients,
  classifyBrevoFailure,
  mapWithConcurrency,
  readBrevoErrorCode,
  type BrevoDispatchResult,
  type BrevoMessage,
  type BrevoTransport,
} from './brevo.transport.js';
import { fakeWorkspace } from '../../workspaces/fake-workspace.js';

const admin: AuthenticatedUser = {
  id: 'usr-admin',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Administrateur CPI',
  role: Role.ADMIN,
};

const asUser = (id: string): AuthenticatedUser => ({
  id,
  email: `${id}@cpi.sn`,
  username: id,
  fullName: id,
  role: Role.COMMERCIAL,
});

async function refusal(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('aucune exception levée alors qu’un refus était attendu');
}

const codeOf = (error: unknown): string | undefined =>
  ((error as { response?: { code?: string } }).response ?? {}).code;

const apresLeBail = (from: Date = new Date()): Date =>
  new Date(from.getTime() + SENDING_LEASE_MS + 60_000);

let db: FakePrisma;
let brevo: FakeBrevoTransport;
let service: NotificationsService;

const baseBody = {
  title: 'Réunion demain',
  body: 'Point commercial à 9 h au siège.',
  audience: NotificationAudience.ALL,
};

beforeEach(() => {
  db = new FakePrisma();
  brevo = new FakeBrevoTransport();
  service = new NotificationsService(db.asService(), fakeWorkspace(), brevo);
});

describe('résolution du public', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1', role: Role.COMMERCIAL, departementId: 'dep-1' });
    db.addUser({ id: 'usr-2', role: Role.COMMERCIAL, departementId: 'dep-2' });
    db.addUser({ id: 'usr-3', role: Role.BANQUE_FINANCE, departementId: 'dep-1' });
    db.addUser({ id: 'usr-inactif', role: Role.COMMERCIAL, isActive: false });
    db.addUser({ id: 'usr-supprime', role: Role.COMMERCIAL, deletedAt: new Date() });
  });

  it('« tout le monde » exclut les comptes désactivés et supprimés', async () => {
    const preview = await service.previewAudience({ audience: NotificationAudience.ALL });
    expect(preview.recipientCount).toBe(4); // admin + usr-1 + usr-2 + usr-3
  });

  it('« par rôle » ne retient que ce rôle', async () => {
    const preview = await service.previewAudience({
      audience: NotificationAudience.ROLE,
      audienceRole: Role.COMMERCIAL,
    });
    expect(preview.recipientCount).toBe(2);
  });

  it('« par département » ne retient que ce département', async () => {
    const preview = await service.previewAudience({
      audience: NotificationAudience.DEPARTEMENT,
      audienceDepartementId: 'dep-1',
    });
    expect(preview.recipientCount).toBe(2); // usr-1 + usr-3
  });

  it('« comptes choisis » déduplique avant de compter', async () => {
    const preview = await service.previewAudience({
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-1', 'usr-2'],
    });
    expect(preview.recipientCount).toBe(2);
  });

  it('LE NOMBRE ANNONCÉ EST CELUI QUI EST SERVI', async () => {
    const selector = {
      audience: NotificationAudience.ROLE,
      audienceRole: Role.COMMERCIAL,
    } as const;
    const preview = await service.previewAudience(selector);

    const created = await service.create(admin, { ...baseBody, ...selector });

    expect(created.counts.total).toBe(preview.recipientCount);
  });

  it('refuse un public vide plutôt que d’enregistrer un envoi sans destinataire', async () => {
    const empty = new FakePrisma();
    empty.users.length = 0;
    const isolated = new NotificationsService(
      empty.asService(),
      fakeWorkspace(),
      new FakeBrevoTransport(),
    );

    const error = await refusal(() => isolated.create(admin, baseBody));
    expect(codeOf(error)).toBe(NotificationError.AUDIENCE_EMPTY);
  });

  it('refuse « par rôle » sans rôle', async () => {
    const error = await refusal(() =>
      service.create(admin, { ...baseBody, audience: NotificationAudience.ROLE }),
    );
    expect(codeOf(error)).toBe(NotificationError.AUDIENCE_ROLE_REQUIRED);
  });

  it('refuse une programmation dans le passé', async () => {
    const error = await refusal(() =>
      service.create(admin, {
        ...baseBody,
        scheduledFor: new Date(Date.now() - 60_000).toISOString(),
      }),
    );
    expect(codeOf(error)).toBe(NotificationError.SCHEDULE_IN_PAST);
  });

  it('refuse un lien profond absolu', async () => {
    const error = await refusal(() =>
      service.create(admin, { ...baseBody, route: 'https://exemple.test/piege' }),
    );
    expect(codeOf(error)).toBe(NotificationError.ROUTE_INVALID);
  });
});

describe('éventail', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1', role: Role.COMMERCIAL, email: 'un@cpi.sn' });
    db.addUser({ id: 'usr-2', role: Role.COMMERCIAL, email: 'deux@cpi.sn' });
    db.addUser({ id: 'usr-3', role: Role.COMMERCIAL, email: 'trois@cpi.sn' });
  });

  it('UNE ADRESSE REFUSÉE N’EMPORTE PAS LE LOT', async () => {
    brevo = new FakeBrevoTransport((email) =>
      email === 'deux@cpi.sn'
        ? { email, ok: false, errorCode: 'invalid_parameter', kind: 'permanent' }
        : { email, ok: true },
    );
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeWorkspace(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-2', 'usr-3'],
    });

    expect(created.counts.sent).toBe(2);
    expect(created.counts.failed).toBe(1);

    const detail = await service.get(created.id);
    const broken = detail.recipients.find((recipient) => recipient.userId === 'usr-2');
    expect(broken?.status).toBe(NotificationDeliveryStatus.FAILED);
    expect(broken?.error).toBe('invalid_parameter');
  });

  it('UN ÉCHEC PASSAGER RESTE EN FILE, il n’est PAS enterré', async () => {
    brevo = new FakeBrevoTransport((email) =>
      email === 'deux@cpi.sn'
        ? { email, ok: false, errorCode: 'HTTP_429', kind: 'transient' }
        : { email, ok: true },
    );
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeWorkspace(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-2', 'usr-3'],
    });

    expect(created.counts.failed).toBe(0);
    expect(created.counts.pending).toBe(1);

    const detail = await service.get(created.id);
    const stalled = detail.recipients.find((recipient) => recipient.userId === 'usr-2');
    expect(stalled?.status).toBe(NotificationDeliveryStatus.PENDING);
    expect(stalled?.error).toBe(DELIVERY_RETRY_ERROR);
  });

  it('UNE LIVRAISON À RÉESSAYER LAISSE L’ENVOI PRENABLE, jamais SENT', async () => {
    brevo = new FakeBrevoTransport((email) =>
      email === 'deux@cpi.sn'
        ? { email, ok: false, errorCode: 'HTTP_429', kind: 'transient' }
        : { email, ok: true },
    );
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeWorkspace(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-2', 'usr-3'],
    });

    expect(created.status).toBe(NotificationStatus.SENDING);
    expect(created.sentAt).toBeNull();
  });

  it('et une fois TOUT tranché, l’envoi se referme sur SENT', async () => {
    brevo = new FakeBrevoTransport((email) =>
      email === 'deux@cpi.sn'
        ? { email, ok: false, errorCode: 'invalid_parameter', kind: 'permanent' }
        : { email, ok: true },
    );
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeWorkspace(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-2', 'usr-3'],
    });

    expect(created.status).toBe(NotificationStatus.SENT);
    expect(created.sentAt).not.toBeNull();
  });

  it('un échec passager repart au passage suivant, et finit par passer', async () => {
    let refuse = true;
    brevo = new FakeBrevoTransport((email) =>
      refuse ? { email, ok: false, errorCode: 'HTTP_503', kind: 'transient' } : { email, ok: true },
    );
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeWorkspace(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    expect(created.counts.pending).toBe(1);

    refuse = false;
    const retry = await service.dispatch(created.id, apresLeBail());

    expect(retry.sent).toBe(1);
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.SENT);
  });

  it('UNE PANNE DE TRANSPORT LAISSE TOUT EN FILE', async () => {
    const broken = new NotificationsService(
      db.asService(),
      fakeWorkspace(),
      new BrokenBrevoTransport(),
    );

    const created = await broken.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    expect(created.transportStatus).toBe('TRANSPORT_ERROR');
    expect(created.counts.failed).toBe(0);
    expect(created.counts.pending).toBe(1);
    expect(db.deliveries[0]?.error).toBe(DELIVERY_RETRY_ERROR);
  });

  it('un transport e-mail qui LÈVE laisse la livraison en file, sans propager', async () => {
    const throwing = new NotificationsService(
      db.asService(),
      fakeWorkspace(),
      new ThrowingBrevoTransport(),
    );

    const created = await throwing.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    expect(created.transportStatus).toBe('TRANSPORT_ERROR');
    expect(created.counts.pending).toBe(1);
    expect(db.deliveries[0]?.error).toBe(DELIVERY_RETRY_ERROR);
  });

  const apresEcheance = (): Date => new Date(Date.now() + 3_600_000 + 60_000);

  const scheduleThree = async (): Promise<string> => {
    brevo.configured = true;
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-2', 'usr-3'],
      scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
    });
    db.breakOn('user.findMany', new Error('Timed out fetching a new connection from the pool'));
    return created.id;
  };

  it('UNE PANNE DE BASE AVANT LE CIBLAGE LAISSE L’ENVOI PRENABLE', async () => {
    const id = await scheduleThree();

    await service.dispatch(id, apresEcheance());
    db.faults.clear();
    const detail = await service.get(id);

    expect(detail.notification.status).toBe(NotificationStatus.SENDING);
    expect(detail.notification.sentAt).toBeNull();
    expect(detail.notification.transportStatus).toBe('TRANSPORT_ERROR');

    expect(db.deliveries).toHaveLength(3);
    for (const delivery of db.deliveries) {
      expect(delivery.status).toBe(NotificationDeliveryStatus.PENDING);
      expect(delivery.error).toBe(DELIVERY_RETRY_ERROR);
    }
  });

  it('la panne passée, la reprise sert bien les trois destinataires', async () => {
    const id = await scheduleThree();
    const echeance = apresEcheance();
    await service.dispatch(id, echeance);

    db.faults.clear();
    const retry = await service.dispatch(id, apresLeBail(echeance));

    expect(retry.sent).toBe(3);
    expect(brevo.allAddresses).toHaveLength(3);
  });

  it('un passage sans clé n’efface pas le marqueur de réessai d’un passage précédent', async () => {
    brevo = new FakeBrevoTransport((email) => ({
      email,
      ok: false,
      errorCode: 'HTTP_503',
      kind: 'transient',
    }));
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeWorkspace(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    expect(db.deliveries[0]?.error).toBe(DELIVERY_RETRY_ERROR);

    brevo.configured = false;
    await service.dispatch(created.id, apresLeBail());

    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.PENDING);
    expect(db.deliveries[0]?.error).toBe(DELIVERY_RETRY_ERROR);
  });

  it('UN REFUS DÉFINITIF DE TOUT LE PUBLIC EST ENTERRÉ, PAS RÉESSAYÉ', async () => {
    brevo = new FakeBrevoTransport((email) => ({
      email,
      ok: false,
      errorCode: 'unauthorized',
      kind: 'permanent',
    }));
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeWorkspace(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-2', 'usr-3'],
    });

    expect(created.counts.failed).toBe(3);
    expect(created.counts.pending).toBe(0);
    expect(db.deliveries.every((row) => row.error === 'unauthorized')).toBe(true);

    expect(created.status).toBe(NotificationStatus.SENT);
  });

  it('mais un refus PASSAGER de tout le public reste, lui, en file', async () => {
    brevo = new FakeBrevoTransport((email) => ({
      email,
      ok: false,
      errorCode: 'HTTP_429',
      kind: 'transient',
    }));
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeWorkspace(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    expect(created.status).toBe(NotificationStatus.SENDING);
    expect(created.counts.failed).toBe(0);
    expect(db.deliveries[0]?.error).toBe(DELIVERY_RETRY_ERROR);
  });

  it('un destinataire non servi par e-mail reste en file, pas en échec', async () => {
    db.addUser({ id: 'usr-banque', role: Role.BANQUE_FINANCE, email: 'banque@cpi.sn' });
    brevo.configured = true;

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-banque'],
    });

    expect(created.counts.pending).toBe(1);
    expect(created.counts.failed).toBe(0);
    const detail = await service.get(created.id);
    expect(detail.recipients[0]?.error).toBe(DELIVERY_INBOX_ONLY);
  });
});

describe('écriture des acceptations au fil de l’eau', () => {
  class DyingBrevoTransport implements BrevoTransport {
    readonly served: string[][] = [];
    calls = 0;

    isConfigured(): boolean {
      return true;
    }

    unavailableReason(): string | null {
      return null;
    }

    send(messages: readonly BrevoMessage[]): Promise<BrevoDispatchResult> {
      this.calls += 1;
      const recipients = messages.flatMap((message) =>
        message.recipients.map((recipient) => recipient.email),
      );
      this.served.push(recipients);
      if (this.calls === 2) return Promise.reject(new Error('processus interrompu'));
      return Promise.resolve({
        status: 'SENT',
        outcomes: recipients.map((email) => ({ email, ok: true })),
      });
    }
  }

  const TOTAL = EMAIL_PERSIST_GROUP_SIZE + 8;
  let dying: DyingBrevoTransport;

  beforeEach(() => {
    for (let index = 0; index < TOTAL; index += 1) {
      const suffix = String(index);
      db.addUser({ id: `usr-${suffix}`, role: Role.COMMERCIAL, email: `${suffix}@cpi.sn` });
    }
    dying = new DyingBrevoTransport();
    service = new NotificationsService(db.asService(), fakeWorkspace(), dying);
  });

  it('LA REPRISE NE RENVOIE QUE CE QUI N’A PAS ÉTÉ ACCEPTÉ', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.ROLE,
      audienceRole: Role.COMMERCIAL,
    });

    expect(dying.calls).toBe(2);
    expect(dying.served[0]).toHaveLength(EMAIL_PERSIST_GROUP_SIZE);

    const acquises = db.deliveries.filter(
      (row) => row.status === NotificationDeliveryStatus.SENT,
    ).length;
    expect(acquises).toBe(EMAIL_PERSIST_GROUP_SIZE);

    expect(created.status).toBe(NotificationStatus.SENDING);

    await service.dispatch(created.id, apresLeBail());
    expect(dying.served[2]).toHaveLength(8);
  });
});

describe('absence de clé Brevo', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1', role: Role.COMMERCIAL, email: 'un@cpi.sn' });
  });

  it('RETIENT l’envoi en SENDING : l’e-mail n’a pas été tenté, il est encore dû', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    expect(created.status).toBe(NotificationStatus.SENDING);
    expect(created.transportStatus).toBe('NOT_CONFIGURED');
    expect(created.counts.pending).toBe(1);
    expect(created.counts.sent).toBe(0);

    expect(db.deliveries[0]?.error).toBeNull();
  });

  it('referme l’envoi sur SENT quand PERSONNE n’est servi par e-mail', async () => {
    db.addUser({ id: 'usr-banque', role: Role.BANQUE_FINANCE, email: 'banque@cpi.sn' });

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-banque'],
    });

    expect(created.status).toBe(NotificationStatus.SENT);
    expect(created.transportStatus).toBe('NOT_CONFIGURED');
    expect(db.deliveries[0]?.error).toBe(DELIVERY_INBOX_ONLY);
  });

  it('ne referme pas sur SENT tant qu’une livraison porte le marqueur de réessai', async () => {
    service = new NotificationsService(db.asService(), fakeWorkspace(), new BrokenBrevoTransport());

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    expect(db.deliveries[0]?.error).toBe(DELIVERY_RETRY_ERROR);
    expect(created.status).toBe(NotificationStatus.SENDING);

    service = new NotificationsService(db.asService(), fakeWorkspace(), brevo);
    await service.dispatch(created.id, apresLeBail());

    const detail = await service.get(created.id);
    expect(detail.notification.status).toBe(NotificationStatus.SENDING);
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.PENDING);
  });

  it('l’e-mail part dès qu’une clé est branchée, sur la MÊME notification', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    expect(brevo.sent).toHaveLength(0);

    brevo.configured = true;
    await service.dispatch(created.id, apresLeBail());

    expect(brevo.allAddresses).toEqual(['un@cpi.sn']);
    const detail = await service.get(created.id);
    expect(detail.notification.status).toBe(NotificationStatus.SENT);
    expect(detail.notification.counts.sent).toBe(1);
  });

  it('la boîte de réception fonctionne quand même, c’est le point du mode dégradé', async () => {
    await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    const inbox = await service.inbox(asUser('usr-1'), {});
    expect(inbox.items).toHaveLength(1);
    expect(inbox.unreadCount).toBe(1);
  });
});

describe('boîte de réception', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1' });
    db.addUser({ id: 'usr-2' });
  });

  it('ne montre que ses propres notifications', async () => {
    await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-2'],
    });

    expect((await service.inbox(asUser('usr-1'), {})).items).toHaveLength(0);
    expect((await service.inbox(asUser('usr-2'), {})).items).toHaveLength(1);
  });

  it('marque lue, et l’opération est idempotente', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    await service.markRead(asUser('usr-1'), created.id);
    const first = (await service.inbox(asUser('usr-1'), {})).items[0]?.readAt;

    await service.markRead(asUser('usr-1'), created.id);
    const second = (await service.inbox(asUser('usr-1'), {})).items[0]?.readAt;

    expect(second).toBe(first);
    expect((await service.inbox(asUser('usr-1'), {})).unreadCount).toBe(0);
  });

  it('LIRE UNE LIVRAISON EN ÉCHEC N’EFFACE PAS L’ÉCHEC', async () => {
    const failing = new FakeBrevoTransport((email) => ({
      email,
      ok: false,
      errorCode: 'invalid_parameter',
      kind: 'permanent',
    }));
    failing.configured = true;
    const isolated = new NotificationsService(db.asService(), fakeWorkspace(), failing);

    const created = await isolated.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.FAILED);

    await isolated.markRead(asUser('usr-1'), created.id);

    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.FAILED);
    expect(db.deliveries[0]?.error).toBe('invalid_parameter');
    expect(db.deliveries[0]?.readAt).not.toBeNull();
    expect((await isolated.inbox(asUser('usr-1'), {})).unreadCount).toBe(0);
    expect((await isolated.get(created.id)).notification.counts.failed).toBe(1);
  });

  it('LIRE UNE LIVRAISON EN ATTENTE DE RÉESSAI N’ANNULE PAS LE RÉESSAI', async () => {
    let refuse = true;
    const flaky = new FakeBrevoTransport((email) =>
      refuse ? { email, ok: false, errorCode: 'HTTP_503', kind: 'transient' } : { email, ok: true },
    );
    flaky.configured = true;
    const isolated = new NotificationsService(db.asService(), fakeWorkspace(), flaky);

    const created = await isolated.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.PENDING);

    await isolated.markRead(asUser('usr-1'), created.id);
    refuse = false;
    const retry = await isolated.dispatch(created.id, apresLeBail());

    expect(retry.sent).toBe(1);
    expect(flaky.allAddresses).toHaveLength(2);
  });

  it('refuse de marquer lue la notification d’un autre', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-2'],
    });

    const error = await refusal(() => service.markRead(asUser('usr-1'), created.id));
    expect(codeOf(error)).toBe(NotificationError.NOT_FOUND);
  });

  it('n’expose pas une notification encore programmée', async () => {
    await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
      scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
    });

    expect((await service.inbox(asUser('usr-1'), {})).items).toHaveLength(0);
  });

  it('filtre les non lues sur demande', async () => {
    const lu = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    await service.create(admin, {
      ...baseBody,
      title: 'Autre',
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    await service.markRead(asUser('usr-1'), lu.id);

    const unread = await service.inbox(asUser('usr-1'), { unreadOnly: true });
    expect(unread.items).toHaveLength(1);
    expect(unread.items[0]?.title).toBe('Autre');
  });
});

describe('programmation', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1', role: Role.COMMERCIAL, email: 'un@cpi.sn' });
    brevo.configured = true;
  });

  it('n’envoie rien tant que l’heure n’est pas venue', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
    });

    expect(created.status).toBe(NotificationStatus.SCHEDULED);
    expect(brevo.sent).toHaveLength(0);
  });

  it('annule un envoi programmé', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
    });

    const cancelled = await service.cancel(created.id);
    expect(cancelled.status).toBe(NotificationStatus.CANCELLED);
    expect(cancelled.cancelledAt).not.toBeNull();
  });

  it('REFUSE d’annuler un envoi déjà parti', async () => {
    const created = await service.create(admin, baseBody);

    const error = await refusal(() => service.cancel(created.id));
    expect(codeOf(error)).toBe(NotificationError.NOT_SCHEDULED);
  });

  it('refuse d’annuler un identifiant inconnu', async () => {
    const error = await refusal(() => service.cancel('ntf-inexistante'));
    expect(codeOf(error)).toBe(NotificationError.NOT_FOUND);
  });
});

describe('canal e-mail', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-tc1', role: Role.COMMERCIAL, email: 'tc1@cpi.sn', fullName: 'Awa Diop' });
    db.addUser({ id: 'usr-tc2', role: Role.COMMERCIAL, email: '' });
    db.addUser({ id: 'usr-banque', role: Role.BANQUE_FINANCE, email: 'banque@cpi.sn' });
  });

  const dispatchTo = async (userIds: readonly string[]) => {
    const row = await db.notification.create({
      data: {
        title: 'Réunion demain',
        body: 'Point commercial à 9 h au siège.',
        status: NotificationStatus.SENDING,
        deliveries: { createMany: { data: userIds.map((userId) => ({ userId })) } },
      },
    });
    return service.dispatch(row.id);
  };

  it('SANS CLÉ, rien ne part et rien ne casse', async () => {
    const summary = await dispatchTo(['usr-tc1']);

    expect(summary.emailStatus).toBe('NOT_CONFIGURED');
    expect(summary.emailed).toBe(0);
    expect(brevo.sent).toHaveLength(0);
    expect(summary.failed).toBe(0);
    expect(summary.pending).toBe(1);
  });

  it('ne sert QUE les commerciaux disposant d’une adresse', async () => {
    brevo.configured = true;

    const summary = await dispatchTo(['usr-tc1', 'usr-tc2', 'usr-banque', 'usr-admin']);

    expect(brevo.allAddresses).toEqual(['tc1@cpi.sn']);
    expect(summary.emailed).toBe(1);
    expect(summary.sent).toBe(1);
    expect(summary.pending).toBe(3);
    expect(summary.emailStatus).toBe('SENT');
  });

  it('adresse l’e-mail avec le titre et le corps de la notification', async () => {
    brevo.configured = true;

    await dispatchTo(['usr-tc1']);

    const message = brevo.sent[0];
    expect(message?.subject).toBe('Réunion demain');
    expect(message?.textContent).toContain('Point commercial à 9 h au siège.');
    expect(message?.htmlContent).toContain('Point commercial à 9 h au siège.');
    expect(message?.recipients[0]?.name).toBe('Awa Diop');
  });

  it('échappe le texte saisi avant de le poser dans le HTML', () => {
    const content = buildEmailContent('<script>alert(1)</script>', 'a & b');
    expect(content.html).not.toContain('<script>');
    expect(content.html).toContain('&lt;script&gt;');
    expect(content.html).toContain('a &amp; b');
    expect(content.text).toContain('a & b');
  });
});

describe('découpage et classement Brevo', () => {
  it('respecte le plafond de 99 destinataires par appel', () => {
    const chunks = chunkRecipients(Array.from({ length: 200 }, (_, index) => index));
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(99);
    expect(chunks[2]).toHaveLength(2);
  });

  it('lit le code d’erreur Brevo quand il y en a un', () => {
    expect(readBrevoErrorCode({ code: 'invalid_parameter' })).toBe('invalid_parameter');
    expect(readBrevoErrorCode({})).toBeUndefined();
    expect(readBrevoErrorCode(null)).toBeUndefined();
  });

  it('classe 429 et 5xx comme passagers, le reste comme définitif', () => {
    expect(classifyBrevoFailure(429)).toBe('transient');
    expect(classifyBrevoFailure(503)).toBe('transient');
    expect(classifyBrevoFailure(400)).toBe('permanent');
    expect(classifyBrevoFailure(401)).toBe('permanent');
  });

  it('le pool de travail respecte l’ordre d’entrée et n’avale pas les rejets', async () => {
    const settled = await mapWithConcurrency([1, 2, 3, 4], 2, (value) =>
      value === 3 ? Promise.reject(new Error('trois')) : Promise.resolve(value * 10),
    );

    expect(settled.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'rejected',
      'fulfilled',
    ]);
    expect(settled[3]).toEqual({ status: 'fulfilled', value: 40 });
  });
});

describe('appels HTTP Brevo', () => {
  const configured = { BREVO_API_KEY: 'cle', BREVO_SENDER_EMAIL: 'no-reply@cpi.sn' };

  const message = (count: number) => ({
    recipients: Array.from({ length: count }, (_, index) => ({
      email: `u${String(index)}@cpi.sn`,
    })),
    subject: 'Sujet',
    htmlContent: '<p>x</p>',
    textContent: 'x',
  });

  it('PLAFONNE LES APPELS SIMULTANÉS', async () => {
    let inFlight = 0;
    let peak = 0;
    let calls = 0;

    vi.stubGlobal('fetch', async () => {
      calls += 1;
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return new Response('{}', { status: 201 });
    });

    try {
      const transport = new BrevoHttpTransport(configured);
      await transport.send([message(2000)]);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(calls).toBe(21);
    expect(peak).toBeLessThanOrEqual(BREVO_MAX_CONCURRENT_CALLS);
  });

  it('POSE UN DÉLAI D’ABANDON SUR CHAQUE APPEL', async () => {
    const seen: (AbortSignal | null | undefined)[] = [];

    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      seen.push(init?.signal);
      return Promise.resolve(new Response('{}', { status: 201 }));
    });

    try {
      const transport = new BrevoHttpTransport(configured);
      await transport.send([message(1)]);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(AbortSignal);
  });

  it('classe un 429 en passager jusque dans l’issue rendue', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('{"code":"too_many_requests"}', { status: 429 })),
    );

    let result;
    try {
      const transport = new BrevoHttpTransport(configured);
      result = await transport.send([message(1)]);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(result.outcomes[0]?.ok).toBe(false);
    expect(result.outcomes[0]?.kind).toBe('transient');
  });

  const withFetch = async (
    count: number,
    handler: (call: number) => Promise<Response>,
  ): Promise<{
    result: Awaited<ReturnType<BrevoHttpTransport['send']>>;
    bodies: Record<string, unknown>[];
  }> => {
    const bodies: Record<string, unknown>[] = [];
    let call = 0;

    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      const brut = typeof init?.body === 'string' ? init.body : '{}';
      bodies.push(JSON.parse(brut) as Record<string, unknown>);
      call += 1;
      return handler(call);
    });

    try {
      return { result: await new BrevoHttpTransport(configured).send([message(count)]), bodies };
    } finally {
      vi.unstubAllGlobals();
    }
  };

  it('un 201 rend SENT, chaque destinataire du lot marqué passé', async () => {
    const { result, bodies } = await withFetch(3, () =>
      Promise.resolve(new Response('{"messageId":"<x>"}', { status: 201 })),
    );

    expect(result.status).toBe('SENT');
    expect(result.outcomes).toHaveLength(3);
    expect(result.outcomes.every((outcome) => outcome.ok)).toBe(true);
    expect(result.outcomes[0]?.errorCode).toBeUndefined();
    expect(result.outcomes[0]?.kind).toBeUndefined();

    expect(bodies).toHaveLength(1);
    expect((bodies[0]?.to as unknown[]).length).toBe(3);
    expect(bodies[0]?.sender).toEqual({ email: 'no-reply@cpi.sn', name: 'CPI GO' });
  });

  it('un 400 est DÉFINITIF et remonte le code de Brevo, pas le statut HTTP', async () => {
    const { result } = await withFetch(2, () =>
      Promise.resolve(new Response('{"code":"invalid_parameter"}', { status: 400 })),
    );

    expect(result.status).toBe('TRANSPORT_ERROR');
    expect(result.outcomes).toHaveLength(2);
    for (const outcome of result.outcomes) {
      expect(outcome.ok).toBe(false);
      expect(outcome.kind).toBe('permanent');
      expect(outcome.errorCode).toBe('invalid_parameter');
    }
  });

  it('sans code dans le corps, l’issue retombe sur le statut HTTP', async () => {
    const { result } = await withFetch(1, () => Promise.resolve(new Response('', { status: 403 })));

    expect(result.outcomes[0]?.errorCode).toBe('HTTP_403');
    expect(result.outcomes[0]?.kind).toBe('permanent');
  });

  it('une coupure réseau est PASSAGÈRE et ne fait pas lever `send`', async () => {
    const { result } = await withFetch(2, () => Promise.reject(new Error('ECONNRESET')));

    expect(result.status).toBe('TRANSPORT_ERROR');
    expect(result.detail).toContain('ECONNRESET');
    for (const outcome of result.outcomes) {
      expect(outcome.ok).toBe(false);
      expect(outcome.errorCode).toBe('NETWORK_ERROR');
      expect(outcome.kind).toBe('transient');
    }
  });

  it('un abandon sur délai est traité comme une coupure, donc PASSAGER', async () => {
    const { result } = await withFetch(1, () =>
      Promise.reject(new DOMException('The operation was aborted.', 'TimeoutError')),
    );

    expect(result.outcomes[0]?.kind).toBe('transient');
    expect(result.outcomes[0]?.errorCode).toBe('NETWORK_ERROR');
  });

  it('des lots aux issues DIFFÉRENTES : chacun garde la sienne, l’envoi reste SENT', async () => {
    const { result, bodies } = await withFetch(250, (call) =>
      Promise.resolve(
        call === 2
          ? new Response('{"code":"invalid_parameter"}', { status: 400 })
          : new Response('{}', { status: 201 }),
      ),
    );

    expect(bodies.map((body) => (body.to as unknown[]).length)).toEqual([99, 99, 52]);

    expect(result.status).toBe('SENT');
    expect(result.outcomes).toHaveLength(250);
    expect(result.outcomes.filter((outcome) => outcome.ok)).toHaveLength(151);

    const refusees = result.outcomes.filter((outcome) => !outcome.ok);
    expect(refusees).toHaveLength(99);
    expect(refusees.every((outcome) => outcome.kind === 'permanent')).toBe(true);
    expect(refusees[0]?.email).toBe('u99@cpi.sn');
    expect(refusees.at(-1)?.email).toBe('u197@cpi.sn');
  });

  it('sans clé, aucun appel réseau et un état NOT_CONFIGURED', async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);

    let result;
    try {
      result = await new BrevoHttpTransport({ BREVO_SENDER_EMAIL: 'no-reply@cpi.sn' }).send([
        message(5),
      ]);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(result.status).toBe('NOT_CONFIGURED');
    expect(result.outcomes).toEqual([]);
    expect(result.detail).toContain('BREVO_API_KEY');
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('une liste vide ne touche pas au réseau', async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);

    let result;
    try {
      result = await new BrevoHttpTransport(configured).send([]);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(result).toEqual({ status: 'SENT', outcomes: [] });
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

describe('workspace démo', () => {
  it('n’appelle jamais Brevo', async () => {
    db.addUser({ id: 'usr-demo', role: Role.COMMERCIAL, email: 'demo@cpi.sn' });
    const demo = new NotificationsService(db.asService(), fakeWorkspace(true), brevo);

    await demo.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-demo'],
    });

    expect(brevo.sent).toHaveLength(0);
  });
});

describe('bail perdu en cours d’expédition', () => {
  const TOTAL = 2 * EMAIL_PERSIST_GROUP_SIZE + 8;

  beforeEach(() => {
    for (let index = 0; index < TOTAL; index += 1) {
      const suffix = String(index);
      db.addUser({ id: `usr-${suffix}`, role: Role.COMMERCIAL, email: `${suffix}@cpi.sn` });
    }
  });

  it('LE DÉTENTEUR ÉVINCÉ N’EXPOSE PAS LA VAGUE SUIVANTE', async () => {
    const created = await db.notification.create({
      data: {
        title: 'Annonce générale',
        body: 'Corps',
        status: NotificationStatus.SENDING,
        deliveries: {
          createMany: {
            data: Array.from({ length: TOTAL }, (_unused, index) => ({
              userId: `usr-${String(index)}`,
            })),
          },
        },
      },
    });

    let vaguesDuPremier = 0;
    let dansLaReprise = false;

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
        if (!dansLaReprise) vaguesDuPremier += 1;
        const adresses = messages.flatMap((message) =>
          message.recipients.map((recipient) => recipient.email),
        );

        if (this.calls === 2 && !dansLaReprise) {
          const apres = new Date(Date.now() + 10 * SENDING_LEASE_MS);
          db.clock = () => apres;
          dansLaReprise = true;
          await new NotificationsService(
            db.asService(),
            fakeWorkspace(),
            new BrokenBrevoTransport(),
          ).dispatch(created.id, apres);
          dansLaReprise = false;
        }

        this.servies.push(...adresses);
        return { status: 'SENT', outcomes: adresses.map((email) => ({ email, ok: true })) };
      }
    })();

    const premier = new NotificationsService(db.asService(), fakeWorkspace(), lent);
    await premier.dispatch(created.id);

    expect(vaguesDuPremier).toBe(2);

    expect(lent.servies).toHaveLength(2 * EMAIL_PERSIST_GROUP_SIZE);
    expect(lent.servies).not.toContain(`${String(TOTAL - 1)}@cpi.sn`);

    const row = db.notifications.find((candidate) => candidate.id === created.id);
    expect(row?.status).toBe(NotificationStatus.SENDING);
    expect(row?.dispatchClaim).not.toBeNull();
  });

  it('L’ÉVINCÉ NE RÉÉCRIT PAS LA CONCLUSION DU REPRENEUR', async () => {
    const tardif = new FakePrisma();
    tardif.addUser({ id: 'usr-tc', role: Role.COMMERCIAL, email: 'tc@cpi.sn' });
    const created = await tardif.notification.create({
      data: {
        title: 'Annonce',
        body: 'Corps',
        status: NotificationStatus.SENDING,
        deliveries: { createMany: { data: [{ userId: 'usr-tc' }] } },
      },
    });

    const bon = new FakeBrevoTransport();
    bon.configured = true;

    const casse = new (class implements BrevoTransport {
      isConfigured(): boolean {
        return true;
      }

      unavailableReason(): string | null {
        return null;
      }

      async send(): Promise<BrevoDispatchResult> {
        const apres = new Date(Date.now() + 10 * SENDING_LEASE_MS);
        tardif.clock = () => apres;
        await new NotificationsService(tardif.asService(), fakeWorkspace(), bon).dispatch(
          created.id,
          apres,
        );
        return { status: 'TRANSPORT_ERROR', outcomes: [], detail: 'HTTP_503' };
      }
    })();

    await new NotificationsService(tardif.asService(), fakeWorkspace(), casse).dispatch(created.id);

    const row = tardif.notifications.find((candidate) => candidate.id === created.id);
    expect(row?.status).toBe(NotificationStatus.SENT);
    expect(row?.transportStatus).toBe('SENT');
    expect(row?.dispatchClaim).toBeNull();
    expect(tardif.deliveries[0]?.status).toBe(NotificationDeliveryStatus.SENT);
    expect(bon.allAddresses).toEqual(['tc@cpi.sn']);
  });
});

describe('borne de reprise', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-tc', role: Role.COMMERCIAL, email: 'tc@cpi.sn' });
  });

  const jamaisServi = async (): Promise<string> => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-tc'],
    });
    expect(created.status).toBe(NotificationStatus.SENDING);
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.PENDING);
    expect(db.deliveries[0]?.error).toBeNull();
    return created.id;
  };

  it('AVANT L’ÉCHÉANCE, l’envoi reste dû et rien n’est enterré', async () => {
    const id = await jamaisServi();

    const veille = await service.dispatch(id, new Date(Date.now() + DISPATCH_DEADLINE_MS - 60_000));

    expect(veille.claimed).toBe(true);
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.PENDING);
    expect((await service.get(id)).notification.status).toBe(NotificationStatus.SENDING);
  });

  it('PASSÉE L’ÉCHÉANCE, l’envoi est abandonné, et l’échec est ÉCRIT', async () => {
    const id = await jamaisServi();

    const tardif = await service.dispatch(id, new Date(Date.now() + DISPATCH_DEADLINE_MS + 60_000));

    expect(tardif.failed).toBe(1);
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.FAILED);
    expect(db.deliveries[0]?.error).toBe(DELIVERY_ABANDONED);

    const detail = await service.get(id);
    expect(detail.notification.status).toBe(NotificationStatus.SENT);
    expect(detail.notification.counts.failed).toBe(1);

    const encore = await service.dispatch(id, new Date(Date.now() + 3 * DISPATCH_DEADLINE_MS));
    expect(encore.claimed).toBe(false);
  });

  it('l’abandon ne retire rien à la boîte de réception', async () => {
    const id = await jamaisServi();
    await service.dispatch(id, new Date(Date.now() + DISPATCH_DEADLINE_MS + 60_000));

    const inbox = await service.inbox(asUser('usr-tc'), {});
    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0]?.notificationId).toBe(id);
  });
});

describe('prise en charge de l’envoi', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-tc', role: Role.COMMERCIAL, email: 'tc@cpi.sn' });
    brevo.configured = true;
  });

  it('N’ENVOIE PAS un envoi programmé dont l’heure n’est pas venue', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-tc'],
      scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
    });

    const tropTot = await service.dispatch(created.id);

    expect(tropTot.claimed).toBe(false);
    expect(brevo.sent).toHaveLength(0);
    expect((await service.get(created.id)).notification.status).toBe(NotificationStatus.SCHEDULED);
  });

  it('N’ENVOIE PAS une seconde fois un envoi déjà refermé', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-tc'],
    });
    expect(created.status).toBe(NotificationStatus.SENT);
    expect(brevo.allAddresses).toEqual(['tc@cpi.sn']);

    const encore = await service.dispatch(created.id, apresLeBail());

    expect(encore.claimed).toBe(false);
    expect(brevo.allAddresses).toEqual(['tc@cpi.sn']);
  });

  it('N’ENVOIE PAS un envoi annulé', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-tc'],
      scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await service.cancel(created.id);

    const apres = await service.dispatch(created.id, new Date(Date.now() + 7_200_000));

    expect(apres.claimed).toBe(false);
    expect(brevo.sent).toHaveLength(0);
  });
});

describe('pagination des listes', () => {
  const MEME_INSTANT = new Date('2026-08-13T08:00:00.000Z');

  it('DEUX LIGNES DE MÊME DATE NE S’ÉCHANGENT PAS ENTRE DEUX PAGES', async () => {
    db.addUser({ id: 'usr-1' });
    db.clock = () => MEME_INSTANT;

    await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    await service.create(admin, {
      ...baseBody,
      title: 'Second envoi',
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    for (const delivery of db.deliveries) delivery.createdAt = MEME_INSTANT;

    db.unstableTies = true;

    const premiere = await service.list({ page: 1, pageSize: 1 });
    const seconde = await service.list({ page: 2, pageSize: 1 });
    expect(premiere.meta.total).toBe(2);
    expect(new Set([premiere.items[0]?.id, seconde.items[0]?.id]).size).toBe(2);

    const boiteA = await service.inbox(asUser('usr-1'), { page: 1, pageSize: 1 });
    const boiteB = await service.inbox(asUser('usr-1'), { page: 2, pageSize: 1 });
    expect(new Set([boiteA.items[0]?.id, boiteB.items[0]?.id]).size).toBe(2);
  });

  it('les destinataires d’un envoi sont rendus dans un ordre déterministe', async () => {
    for (const id of ['usr-a', 'usr-b', 'usr-c']) db.addUser({ id });
    db.clock = () => MEME_INSTANT;

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-a', 'usr-b', 'usr-c'],
    });
    for (const delivery of db.deliveries) delivery.createdAt = MEME_INSTANT;

    db.unstableTies = true;

    const premier = await service.get(created.id);
    const second = await service.get(created.id);
    expect(premier.recipients.map((row) => row.userId)).toEqual(
      second.recipients.map((row) => row.userId),
    );
  });
});
