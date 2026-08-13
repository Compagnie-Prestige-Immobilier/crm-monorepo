import {
  NotificationAudience,
  NotificationDeliveryStatus,
  NotificationStatus,
  Role,
} from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { NotificationsService } from './notifications.service.js';
import { DevicesService } from './devices.service.js';
import { NotificationError } from './errors.js';
import { BrokenTransport, FakePrisma, FakeTransport } from './fake-prisma.js';
import { chunkTokens, classifyFcmError, readFcmErrorCode } from './fcm.transport.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

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

/** Exécute et rend l'erreur levée. Échoue explicitement si l'appel réussit. */
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

let db: FakePrisma;
let transport: FakeTransport;
let service: NotificationsService;

const baseBody = {
  title: 'Réunion demain',
  body: 'Point commercial à 9 h au siège.',
  audience: NotificationAudience.ALL,
};

beforeEach(() => {
  db = new FakePrisma();
  transport = new FakeTransport();
  service = new NotificationsService(db.asService(), transport, fakeDemoVisibility());
});

// ─────────────────────────────────────────────────────────────────────────────
// Public
// ─────────────────────────────────────────────────────────────────────────────

describe('résolution du public', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1', role: Role.COMMERCIAL, departementId: 'dep-1' });
    db.addUser({ id: 'usr-2', role: Role.COMMERCIAL, departementId: 'dep-2' });
    db.addUser({ id: 'usr-3', role: Role.BANQUE_FINANCE, departementId: 'dep-1' });
    db.addUser({ id: 'usr-inactif', role: Role.COMMERCIAL, isActive: false });
    db.addUser({ id: 'usr-supprime', role: Role.COMMERCIAL, deletedAt: new Date() });
  });

  it('« tout le monde » exclut les comptes désactivés et supprimés', async () => {
    // Un commercial dont l'accès a été fermé ne doit plus recevoir de consignes
    // de travail sur son téléphone personnel.
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
    // Choisir deux fois la même personne afficherait « 2 destinataires » pour
    // une seule — au moment précis où l'admin décide de confirmer.
    const preview = await service.previewAudience({
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-1', 'usr-2'],
    });
    expect(preview.recipientCount).toBe(2);
  });

  it('LE NOMBRE ANNONCÉ EST CELUI QUI EST SERVI', async () => {
    // C'est l'invariant qui justifie que l'aperçu et l'envoi partagent
    // `buildAudienceWhere`. Deux implémentations divergentes produiraient un
    // compteur qui ment sur une action non annulable.
    const selector = {
      audience: NotificationAudience.ROLE,
      audienceRole: Role.COMMERCIAL,
    } as const;
    const preview = await service.previewAudience(selector);

    const created = await service.create(admin, { ...baseBody, ...selector });

    expect(created.counts.total).toBe(preview.recipientCount);
  });

  it('distingue « visé » de « joignable »', async () => {
    db.addDevice({ userId: 'usr-1', token: 'tok-1' });
    db.addDevice({ userId: 'usr-1', token: 'tok-1-bis' });

    const preview = await service.previewAudience({
      audience: NotificationAudience.ROLE,
      audienceRole: Role.COMMERCIAL,
    });

    expect(preview.recipientCount).toBe(2);
    // Deux téléphones, UNE personne joignable.
    expect(preview.reachableCount).toBe(1);
  });

  it('refuse un public vide plutôt que d’enregistrer un envoi sans destinataire', async () => {
    const empty = new FakePrisma();
    empty.users.length = 0;
    const isolated = new NotificationsService(
      empty.asService(),
      new FakeTransport(),
      fakeDemoVisibility(),
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
    // Une URL dans une notification portant le logo de l'application est un
    // vecteur d'hameçonnage que l'utilisateur ne peut pas inspecter.
    const error = await refusal(() =>
      service.create(admin, { ...baseBody, route: 'https://exemple.test/piege' }),
    );
    expect(codeOf(error)).toBe(NotificationError.ROUTE_INVALID);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Éventail
// ─────────────────────────────────────────────────────────────────────────────

describe('éventail', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1' });
    db.addUser({ id: 'usr-2' });
    db.addUser({ id: 'usr-3' });
    db.addDevice({ userId: 'usr-1', token: 'tok-1' });
    db.addDevice({ userId: 'usr-2', token: 'tok-mort' });
    db.addDevice({ userId: 'usr-3', token: 'tok-3' });
  });

  it('UN JETON DÉFAILLANT N’EMPORTE PAS LE LOT', async () => {
    transport = new FakeTransport((message) =>
      message.token === 'tok-mort'
        ? { token: message.token, ok: false, errorCode: 'INVALID_ARGUMENT', kind: 'invalid' }
        : { token: message.token, ok: true },
    );
    service = new NotificationsService(db.asService(), transport, fakeDemoVisibility());

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
    expect(broken?.error).toBe('INVALID_ARGUMENT');
  });

  it('UNREGISTERED ÉLAGUE LE JETON, définitivement', async () => {
    // Un jeton mort le reste. Le réessayer à chaque envoi ferait croire à un
    // taux d'échec permanent alors que l'application a été désinstallée.
    transport = new FakeTransport((message) =>
      message.token === 'tok-mort'
        ? { token: message.token, ok: false, errorCode: 'UNREGISTERED', kind: 'unregistered' }
        : { token: message.token, ok: true },
    );
    service = new NotificationsService(db.asService(), transport, fakeDemoVisibility());

    await service.create(admin, { ...baseBody, audience: NotificationAudience.ALL });

    const pruned = db.deviceTokens.find((row) => row.token === 'tok-mort');
    expect(pruned?.revokedAt).not.toBeNull();

    // Et il ne repart pas au tour suivant.
    transport.batches.length = 0;
    await service.create(admin, { ...baseBody, audience: NotificationAudience.ALL });
    expect(transport.allMessages.map((message) => message.token)).not.toContain('tok-mort');
  });

  it('n’élague QUE UNREGISTERED — un argument invalide ne détruit rien', async () => {
    // INVALID_ARGUMENT couvre aussi bien un jeton malformé qu'un corps de
    // message fautif. Élaguer dessus détruirait les jetons d'une campagne
    // entière à cause d'une charge utile mal formée, sans retour possible.
    transport = new FakeTransport((message) => ({
      token: message.token,
      ok: false,
      errorCode: 'INVALID_ARGUMENT',
      kind: 'invalid',
    }));
    service = new NotificationsService(db.asService(), transport, fakeDemoVisibility());

    await service.create(admin, baseBody);

    expect(db.deviceTokens.every((row) => row.revokedAt === null)).toBe(true);
  });

  it('un destinataire à trois téléphones ne fait qu’UNE livraison', async () => {
    db.addDevice({ userId: 'usr-1', token: 'tok-1-b' });
    db.addDevice({ userId: 'usr-1', token: 'tok-1-c' });

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    expect(created.counts.total).toBe(1);
    expect(created.counts.sent).toBe(1);
    expect(transport.allMessages).toHaveLength(3);
  });

  it('passe à SENT dès qu’UN appareil accepte, même si les autres échouent', async () => {
    db.addDevice({ userId: 'usr-1', token: 'tok-1-casse' });
    transport = new FakeTransport((message) =>
      message.token === 'tok-1-casse'
        ? { token: message.token, ok: false, errorCode: 'UNAVAILABLE', kind: 'transient' }
        : { token: message.token, ok: true },
    );
    service = new NotificationsService(db.asService(), transport, fakeDemoVisibility());

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    expect(created.counts.sent).toBe(1);
    expect(created.counts.failed).toBe(0);
  });

  it('un destinataire sans appareil reste en file, pas en échec', async () => {
    db.addUser({ id: 'usr-sans-tel' });

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-sans-tel'],
    });

    // Rien n'a échoué : il n'y avait rien à joindre. La personne verra le
    // message en ouvrant l'application.
    expect(created.counts.pending).toBe(1);
    expect(created.counts.failed).toBe(0);
    const detail = await service.get(created.id);
    expect(detail.recipients[0]?.error).toBe('NO_DEVICE');
  });

  it('transmet la route dans la charge utile — c’est l’objet de la fonctionnalité', async () => {
    await service.create(admin, {
      ...baseBody,
      route: '/phase2?phone=%2B221771234567',
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    const message = transport.allMessages[0];
    expect(message?.data.route).toBe('/phase2?phone=%2B221771234567');
    expect(message?.data.notificationId).toBeTruthy();
    // FCM refuse le message entier si une valeur de `data` n'est pas une chaîne.
    expect(Object.values(message?.data ?? {}).every((value) => typeof value === 'string')).toBe(
      true,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mode dégradé
// ─────────────────────────────────────────────────────────────────────────────

describe('absence de transport', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1' });
    db.addDevice({ userId: 'usr-1', token: 'tok-1' });
    transport.configured = false;
  });

  it('stocke et met en file au lieu de planter', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    expect(created.status).toBe(NotificationStatus.SENT);
    expect(created.transportStatus).toBe('NOT_CONFIGURED');
    expect(created.counts.pending).toBe(1);
    expect(created.counts.sent).toBe(0);
  });

  it('la boîte de réception fonctionne quand même — c’est le point du mode dégradé', async () => {
    await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    const inbox = await service.inbox(asUser('usr-1'), {});
    expect(inbox.items).toHaveLength(1);
    expect(inbox.unreadCount).toBe(1);
  });

  it('l’aperçu le dit à l’administrateur au lieu de le laisser croire à un envoi', async () => {
    const preview = await service.previewAudience({ audience: NotificationAudience.ALL });
    expect(preview.transportConfigured).toBe(false);
    expect(preview.transportReason).not.toBeNull();
  });

  it('un échec d’authentification Google n’élague AUCUN jeton', async () => {
    // Aucun jeton n'est en cause quand c'est l'échange OAuth qui a échoué.
    // Élaguer ici détruirait toute la base d'appareils sur une panne passagère.
    const broken = new NotificationsService(
      db.asService(),
      new BrokenTransport(),
      fakeDemoVisibility(),
    );
    const created = await broken.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    expect(created.transportStatus).toBe('TRANSPORT_ERROR');
    expect(db.deviceTokens.every((row) => row.revokedAt === null)).toBe(true);
    expect(created.counts.pending).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Boîte de réception
// ─────────────────────────────────────────────────────────────────────────────

describe('boîte de réception', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1' });
    db.addUser({ id: 'usr-2' });
    db.addDevice({ userId: 'usr-1', token: 'tok-1' });
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

    // La PREMIÈRE lecture est la seule intéressante : elle ne doit pas être
    // réécrite par un second appel.
    expect(second).toBe(first);
    expect((await service.inbox(asUser('usr-1'), {})).unreadCount).toBe(0);
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
    // Elle n'a pas encore eu lieu : la faire figurer dans la boîte de réception
    // révélerait le contenu avant l'heure choisie.
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

// ─────────────────────────────────────────────────────────────────────────────
// Programmation et annulation
// ─────────────────────────────────────────────────────────────────────────────

describe('programmation', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1' });
    db.addDevice({ userId: 'usr-1', token: 'tok-1' });
  });

  it('n’envoie rien tant que l’heure n’est pas venue', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
    });

    expect(created.status).toBe(NotificationStatus.SCHEDULED);
    expect(transport.allMessages).toHaveLength(0);
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
    // Un téléphone qui a sonné ne se rappelle pas. Marquer « annulée » une
    // notification déjà lue serait un mensonge dans l'historique.
    const created = await service.create(admin, baseBody);

    const error = await refusal(() => service.cancel(created.id));
    expect(codeOf(error)).toBe(NotificationError.NOT_SCHEDULED);
  });

  it('refuse d’annuler un identifiant inconnu', async () => {
    const error = await refusal(() => service.cancel('ntf-inexistante'));
    expect(codeOf(error)).toBe(NotificationError.NOT_FOUND);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Réattribution d'appareil
// ─────────────────────────────────────────────────────────────────────────────

describe('réattribution d’un appareil entre utilisateurs', () => {
  let devices: DevicesService;

  beforeEach(() => {
    db.addUser({ id: 'usr-1' });
    db.addUser({ id: 'usr-2' });
    devices = new DevicesService(db.asService(), transport);
  });

  it('DÉPLACE le jeton au lieu de le dupliquer', async () => {
    // Les téléphones se prêtent. Deux lignes pour un seul appareil feraient
    // sonner l'ancien propriétaire sur un téléphone qui n'est plus le sien :
    // ce n'est pas un doublon, c'est une fuite.
    await devices.register(asUser('usr-1'), { token: 'tok-partage' });
    await devices.register(asUser('usr-2'), { token: 'tok-partage' });

    const rows = db.deviceTokens.filter((row) => row.token === 'tok-partage');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe('usr-2');
  });

  it('l’ancien propriétaire ne reçoit plus rien sur cet appareil', async () => {
    await devices.register(asUser('usr-1'), { token: 'tok-partage' });
    await devices.register(asUser('usr-2'), { token: 'tok-partage' });

    await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    expect(transport.allMessages).toHaveLength(0);
  });

  it('la déconnexion révoque, et la reconnexion ressuscite', async () => {
    await devices.register(asUser('usr-1'), { token: 'tok-1' });
    await devices.unregister(asUser('usr-1'), { token: 'tok-1' });
    expect(db.deviceTokens[0]?.revokedAt).not.toBeNull();

    await devices.register(asUser('usr-1'), { token: 'tok-1' });
    // Sans cette réanimation, l'utilisateur ne recevrait plus jamais rien et
    // rien ne le signalerait.
    expect(db.deviceTokens[0]?.revokedAt).toBeNull();
  });

  it('ne laisse pas révoquer le jeton d’un autre', async () => {
    await devices.register(asUser('usr-1'), { token: 'tok-1' });
    await devices.unregister(asUser('usr-2'), { token: 'tok-1' });
    expect(db.deviceTokens[0]?.revokedAt).toBeNull();
  });

  it('conserve le DÉBUT du retard à travers les battements de cœur', async () => {
    const start = new Date('2026-08-10T08:00:00Z');
    db.addDevice({ userId: 'usr-1', token: 'tok-1', pendingOps: 5, pendingSince: start });

    await devices.register(asUser('usr-1'), { token: 'tok-1', pendingOps: 7 });

    // Écraser `pendingSince` à chaque enregistrement remettrait le compteur à
    // zéro toutes les quinze minutes, et le rappel ne partirait jamais.
    expect(db.deviceTokens[0]?.pendingSince?.getTime()).toBe(start.getTime());
    expect(db.deviceTokens[0]?.pendingOps).toBe(7);
  });

  it('efface le retard quand la file se vide', async () => {
    db.addDevice({ userId: 'usr-1', token: 'tok-1', pendingOps: 5, pendingSince: new Date() });
    await devices.register(asUser('usr-1'), { token: 'tok-1', pendingOps: 0 });
    expect(db.deviceTokens[0]?.pendingSince).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Détails du transport
// ─────────────────────────────────────────────────────────────────────────────

describe('découpage et classement FCM', () => {
  it('respecte le plafond de 500 jetons par lot', () => {
    const chunks = chunkTokens(Array.from({ length: 1201 }, (_, index) => index));
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(500);
    expect(chunks[2]).toHaveLength(201);
  });

  it('reconnaît UNREGISTERED dans les détails d’erreur', () => {
    const payload = {
      error: {
        status: 'NOT_FOUND',
        details: [
          {
            '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
            errorCode: 'UNREGISTERED',
          },
        ],
      },
    };
    expect(readFcmErrorCode(payload)).toBe('UNREGISTERED');
    expect(classifyFcmError('UNREGISTERED', 404)).toBe('unregistered');
  });

  it('classe INVALID_ARGUMENT comme invalide, pas comme mort', () => {
    expect(classifyFcmError('INVALID_ARGUMENT', 400)).toBe('invalid');
  });

  it('classe un 503 comme passager', () => {
    expect(classifyFcmError(undefined, 503)).toBe('transient');
  });

  it('retombe sur `error.status` quand les détails manquent', () => {
    expect(readFcmErrorCode({ error: { status: 'UNAVAILABLE' } })).toBe('UNAVAILABLE');
    expect(readFcmErrorCode({})).toBeUndefined();
    expect(readFcmErrorCode(null)).toBeUndefined();
  });
});
