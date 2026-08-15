import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  ClientRequestStatus,
  EnrollmentMethod,
  NotificationAudience,
  Phase2Status,
  Role,
} from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { ClientRequestsService } from './client-requests.service.js';

type MockFn = ReturnType<typeof vi.fn>;

type MockDb = {
  clientCreationRequest: Record<
    'count' | 'findMany' | 'findFirst' | 'create' | 'update' | 'updateMany',
    MockFn
  >;
  prospect: Record<'findFirst' | 'create', MockFn>;
  representant: Record<'findFirst', MockFn>;
  syndicat: Record<'findUnique', MockFn>;
  banque: Record<'findUnique', MockFn>;
  $transaction: MockFn;
};

const BANKER: AuthenticatedUser = {
  id: 'bank-1',
  email: 'agent@cbao.sn',
  username: 'agent',
  fullName: 'Agent CBAO',
  role: Role.BANQUE_FINANCE,
};

const ADMIN: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Admin CPI',
  role: Role.ADMIN,
};

const date = new Date('2026-04-08T14:30:00.000Z');

const requestRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'req-1',
  nom: 'Ndiaye',
  prenom: 'Fatou',
  phoneE164: '+221771234567',
  note: null,
  banqueId: 'banque-1',
  banque: { name: 'CBAO' },
  requestedById: BANKER.id,
  requestedBy: { fullName: BANKER.fullName },
  status: ClientRequestStatus.PENDING,
  reviewedById: null,
  reviewedBy: null,
  reviewedAt: null,
  rejectionNote: null,
  createdProspectId: null,
  createdAt: date,
  updatedAt: date,
  isDemo: false,
  ...over,
});

function prismaStub(): MockDb {
  const db: MockDb = {
    clientCreationRequest: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      // L'arbitrage se gagne par une écriture CONDITIONNELLE : elle rend le
      // nombre de lignes touchées, et zéro signifie « quelqu'un est passé
      // avant ». Le double doit donc répondre 1 par défaut.
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    prospect: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    representant: { findFirst: vi.fn() },
    syndicat: { findUnique: vi.fn() },
    banque: { findUnique: vi.fn().mockResolvedValue({ id: 'banque-1' }) },
    $transaction: vi.fn(),
  };
  // Le rappel de transaction interactive de Prisma est asynchrone à dessein.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  db.$transaction.mockImplementation((run: (tx: MockDb) => Promise<unknown>) => run(db));
  return db;
}

let db: MockDb;
let notify: { create: MockFn };
let service: ClientRequestsService;

beforeEach(() => {
  db = prismaStub();
  notify = { create: vi.fn().mockResolvedValue({}) };
  service = new ClientRequestsService(
    db as unknown as PrismaService,
    notify as unknown as NotificationsService,
    fakeDemoVisibility(),
  );
});

describe('dépôt d’une demande', () => {
  it('NORMALISE le téléphone avant tout contrôle', async () => {
    // « 77 123 45 67 » et « +221771234567 » désignent le même abonné. Sans
    // normalisation, la demande passerait sur un client pourtant déjà en base.
    db.clientCreationRequest.findFirst.mockResolvedValue(null);
    db.clientCreationRequest.create.mockResolvedValue(requestRow());

    const created = await service.create(BANKER, {
      nom: 'Ndiaye',
      prenom: 'Fatou',
      phone: '77 123 45 67',
      banqueId: 'banque-1',
    });

    expect(created.phoneE164).toBe('+221771234567');
    const args = (db.prospect.findFirst.mock.calls[0] as [{ where: Record<string, unknown> }])[0];
    expect(args.where).toMatchObject({
      phoneE164: '+221771234567',
      deletedAt: null,
      isDemo: false,
    });
  });

  it('REFUSE quand le prospect existe déjà, en renvoyant son numéro', async () => {
    // C'est le cas utile : la recherche de l'agent a échoué sur une faute de
    // frappe du nom. Créer un doublon serait la pire issue.
    db.prospect.findFirst.mockResolvedValue({ id: 'prospect-1' });

    const error = await service
      .create(BANKER, {
        nom: 'Ndiaye',
        prenom: 'Fatou',
        phone: '+221771234567',
        banqueId: 'banque-1',
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as { response: { code: string } }).response.code).toBe(
      'CLIENT_REQUEST_PROSPECT_EXISTS',
    );
  });

  it('refuse une seconde demande en attente sur le même numéro', async () => {
    db.clientCreationRequest.findFirst.mockResolvedValue({ id: 'req-existante' });

    const error = await service
      .create(BANKER, {
        nom: 'Ndiaye',
        prenom: 'Fatou',
        phone: '+221771234567',
        banqueId: 'banque-1',
      })
      .catch((caught: unknown) => caught);

    expect((error as { response: { code: string } }).response.code).toBe(
      'CLIENT_REQUEST_ALREADY_PENDING',
    );
  });

  it('refuse une banque inconnue', async () => {
    db.banque.findUnique.mockResolvedValue(null);
    await expect(
      service.create(BANKER, {
        nom: 'Ndiaye',
        prenom: 'Fatou',
        phone: '+221771234567',
        banqueId: 'inconnue',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('prévient les ADMIN, et un échec de notification NE PERD PAS la demande', async () => {
    // La demande est déjà écrite : la perdre parce que le canal d'alerte est
    // indisponible remettrait l'agent dans l'impasse que ce module lève.
    db.clientCreationRequest.findFirst.mockResolvedValue(null);
    db.clientCreationRequest.create.mockResolvedValue(requestRow());
    notify.create.mockRejectedValue(new Error('transport hors service'));

    const created = await service.create(BANKER, {
      nom: 'Ndiaye',
      prenom: 'Fatou',
      phone: '+221771234567',
      banqueId: 'banque-1',
    });

    expect(created.id).toBe('req-1');
    expect(notify.create).toHaveBeenCalledWith(
      BANKER,
      expect.objectContaining({
        audience: NotificationAudience.ROLE,
        audienceRole: Role.ADMIN,
        route: '/demandes-clients',
      }),
    );
  });
});

describe('lecture', () => {
  it('CLOISONNE : un agent bancaire ne voit que ses propres demandes', async () => {
    // L'identité des clients qu'une autre banque cherche à faire créer est une
    // fuite entre concurrents, pas une commodité.
    await service.list(BANKER, {});
    const args = (
      db.clientCreationRequest.findMany.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0];
    expect(args.where).toMatchObject({ requestedById: BANKER.id });
  });

  it('ne cloisonne pas l’ADMIN, qui arbitre', async () => {
    await service.list(ADMIN, {});
    const args = (
      db.clientCreationRequest.findMany.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0];
    expect(args.where).not.toHaveProperty('requestedById');
  });

  it('compte les demandes en attente HORS filtre, pour la pastille du menu', async () => {
    // Filtré, ce compteur retomberait à zéro dès qu'un admin consulte l'onglet
    // « approuvées », et la pastille cesserait de signaler ce qui reste à faire.
    db.clientCreationRequest.count.mockResolvedValueOnce(12).mockResolvedValueOnce(3);
    const result = await service.list(ADMIN, { status: ClientRequestStatus.APPROVED });

    expect(result.pendingCount).toBe(3);
    const pendingArgs = (
      db.clientCreationRequest.count.mock.calls[1] as [{ where: Record<string, unknown> }]
    )[0];
    expect(pendingArgs.where).toMatchObject({ status: ClientRequestStatus.PENDING });
  });
});

describe('approbation', () => {
  const body = {
    representantId: 'rep-1',
    syndicatId: 'syn-1',
    enrollmentMethod: EnrollmentMethod.PLATFORM,
  };

  beforeEach(() => {
    db.clientCreationRequest.findFirst.mockResolvedValue(requestRow());
    db.representant.findFirst.mockResolvedValue({ id: 'rep-1' });
    db.syndicat.findUnique.mockResolvedValue({ id: 'syn-1' });
  });

  it('crée le prospect en METHOD_OBTAINED avec sa provenance', async () => {
    // METHOD_OBTAINED est la condition EXACTE du filtre de recherche bancaire :
    // en PENDING, la fiche serait invisible à celui-là même qui l'a demandée.
    await service.approve(ADMIN, 'req-1', body);

    const args = (db.prospect.create.mock.calls[0] as [{ data: Record<string, unknown> }])[0];
    expect(args.data).toMatchObject({
      nom: 'Ndiaye',
      prenom: 'Fatou',
      phoneE164: '+221771234567',
      origin: 'BANQUE',
      originLabel: 'CBAO',
      phase2Status: Phase2Status.METHOD_OBTAINED,
      enrollmentMethod: EnrollmentMethod.PLATFORM,
      enrollmentCapturedById: ADMIN.id,
    });
  });

  it('écrit le prospect ET la demande dans la MÊME transaction', async () => {
    // Un prospect orphelin et une demande éternellement en attente sur un
    // numéro désormais pris seraient impossibles à rattraper à la main.
    await service.approve(ADMIN, 'req-1', body);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const update = (
      db.clientCreationRequest.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ]
    )[0];
    expect(update.data).toMatchObject({
      status: ClientRequestStatus.APPROVED,
      reviewedById: ADMIN.id,
    });
    expect(update.data.createdProspectId).toEqual(expect.any(String));
    // Le `status: PENDING` dans le `where` EST la garde de concurrence : sans
    // lui, deux administrateurs qui arbitrent la même demande écrivent tous
    // les deux et le second écrase le premier.
    expect(update.where).toMatchObject({ id: 'req-1', status: ClientRequestStatus.PENDING });
  });

  /**
   * Deux administrateurs devant le même écran d'arbitrage est le cas ORDINAIRE.
   * `loadPending` lit hors transaction : les deux la franchissent. Seule
   * l'écriture conditionnelle départage, et le perdant doit faire avorter la
   * transaction, donc défaire le prospect qu'il venait de créer.
   */
  it('REFUSE d’approuver une demande qu’un autre administrateur vient d’arbitrer', async () => {
    db.clientCreationRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.approve(ADMIN, 'req-1', body)).rejects.toMatchObject({
      response: { code: 'CLIENT_REQUEST_ALREADY_REVIEWED' },
    });
  });

  it('REFUSE de refuser une demande qu’un autre administrateur vient d’arbitrer', async () => {
    db.clientCreationRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.reject(ADMIN, 'req-1', { reason: 'Doublon' })).rejects.toMatchObject({
      response: { code: 'CLIENT_REQUEST_ALREADY_REVIEWED' },
    });
  });

  it('PROPAGE isDemo : une demande fictive ne doit pas créer un prospect réel', async () => {
    db.clientCreationRequest.findFirst.mockResolvedValue(requestRow({ isDemo: true }));
    await service.approve(ADMIN, 'req-1', body);

    const args = (db.prospect.create.mock.calls[0] as [{ data: Record<string, unknown> }])[0];
    expect(args.data.isDemo).toBe(true);
  });

  it('relit le téléphone JUSTE AVANT d’écrire', async () => {
    // Entre le dépôt et l'arbitrage, un commercial a très bien pu saisir la
    // fiche en tournée.
    db.prospect.findFirst.mockResolvedValue({ id: 'prospect-1' });
    await expect(service.approve(ADMIN, 'req-1', body)).rejects.toBeInstanceOf(ConflictException);
    expect(db.prospect.create).not.toHaveBeenCalled();
  });

  it('refuse un second arbitrage', async () => {
    db.clientCreationRequest.findFirst.mockResolvedValue(
      requestRow({ status: ClientRequestStatus.APPROVED }),
    );
    const error = await service.approve(ADMIN, 'req-1', body).catch((caught: unknown) => caught);
    expect((error as { response: { code: string } }).response.code).toBe(
      'CLIENT_REQUEST_ALREADY_REVIEWED',
    );
  });

  it('refuse un représentant ou un syndicat introuvable', async () => {
    db.representant.findFirst.mockResolvedValue(null);
    await expect(service.approve(ADMIN, 'req-1', body)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );

    db.representant.findFirst.mockResolvedValue({ id: 'rep-1' });
    db.syndicat.findUnique.mockResolvedValue(null);
    await expect(service.approve(ADMIN, 'req-1', body)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('notifie le demandeur, pas tout le monde', async () => {
    await service.approve(ADMIN, 'req-1', body);
    expect(notify.create).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({
        audience: NotificationAudience.USERS,
        audienceUserIds: [BANKER.id],
      }),
    );
  });

  it('refuse une demande inexistante', async () => {
    db.clientCreationRequest.findFirst.mockResolvedValue(null);
    await expect(service.approve(ADMIN, 'absente', body)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('refus', () => {
  it('enregistre le motif et le renvoie au demandeur', async () => {
    db.clientCreationRequest.findFirst
      .mockResolvedValueOnce(requestRow())
      .mockResolvedValue(
        requestRow({ status: ClientRequestStatus.REJECTED, rejectionNote: 'Déjà client CBAO' }),
      );

    const result = await service.reject(ADMIN, 'req-1', { reason: 'Déjà client CBAO' });

    expect(result.status).toBe(ClientRequestStatus.REJECTED);
    expect(result.rejectionNote).toBe('Déjà client CBAO');
    expect(notify.create).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({ audienceUserIds: [BANKER.id] }),
    );
  });
});
