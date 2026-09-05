import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { OuverturesService, fermerOuverture } from './ouvertures.service.js';
import type { OuvrirFicheDto } from './dto.js';

type MockFn = ReturnType<typeof vi.fn>;

const AWA: AuthenticatedUser = {
  id: 'com-awa',
  email: 'awa@cpi.sn',
  username: 'awa',
  fullName: 'Awa Sy',
  role: Role.COMMERCIAL,
};

const FATOU: AuthenticatedUser = { ...AWA, id: 'sup-fatou', role: Role.SUPERVISEUR };

const REP = '0198a000-0000-7000-8000-000000000001';
const OUVERTURE = '0198d000-0000-7000-8000-000000000001';

const ligne = (over: Record<string, unknown> = {}) => ({
  id: OUVERTURE,
  openedById: AWA.id,
  openedBy: { fullName: AWA.fullName },
  representantId: REP,
  representant: { fullName: 'Moussa Ba' },
  prospectId: null,
  prospect: null,
  openedAt: new Date('2026-09-01T09:00:00.000Z'),
  closedAt: null,
  closingAttemptId: null,
  draft: null,
  releasedById: null,
  releasedBy: null,
  releasedAt: null,
  ...over,
});

let db: {
  ouvertureFiche: {
    findUnique: MockFn;
    findFirst: MockFn;
    findMany: MockFn;
    findUniqueOrThrow: MockFn;
    create: MockFn;
    updateMany: MockFn;
  };
  representant: { findFirst: MockFn; update: MockFn };
  prospect: { findFirst: MockFn };
  scheduledCallback: { updateMany: MockFn; createMany: MockFn };
  $transaction: MockFn;
  $queryRaw: MockFn;
};
let service: OuverturesService;

const corps = (over: Record<string, unknown> = {}): OuvrirFicheDto =>
  ({
    id: OUVERTURE,
    representantId: REP,
    openedAt: '2026-09-01T09:00:00.000Z',
    ...over,
  }) as OuvrirFicheDto;

const violationUnicite = (): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: '7.9.0',
  });

beforeEach(() => {
  db = {
    ouvertureFiche: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findUniqueOrThrow: vi.fn().mockResolvedValue(ligne()),
      create: vi.fn().mockResolvedValue(ligne()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    representant: { findFirst: vi.fn().mockResolvedValue({ id: REP }), update: vi.fn() },
    prospect: { findFirst: vi.fn().mockResolvedValue(null) },
    scheduledCallback: { updateMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn((fn: (client: unknown) => unknown) => fn(db)),
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  service = new OuverturesService(db as unknown as PrismaService);
});

describe('ouvrir une fiche', () => {
  it('refuse une ouverture sans cible, et une ouverture à deux cibles', async () => {
    await expect(service.ouvrir(AWA, corps({ representantId: undefined }))).rejects.toMatchObject({
      response: { code: 'OUVERTURE_CIBLE_INVALIDE' },
    });
    await expect(
      service.ouvrir(AWA, corps({ prospectId: '0198e000-0000-7000-8000-000000000001' })),
    ).rejects.toMatchObject({ response: { code: 'OUVERTURE_CIBLE_INVALIDE' } });
    expect(db.ouvertureFiche.create).not.toHaveBeenCalled();
  });

  it('refuse une fiche hors des campagnes de l’appelant', async () => {
    db.representant.findFirst.mockResolvedValue(null);

    await expect(service.ouvrir(AWA, corps())).rejects.toMatchObject({
      response: { code: 'OUVERTURE_FICHE_INTROUVABLE' },
    });
  });

  it('garde l’heure du terrain telle qu’elle est envoyée', async () => {
    await service.ouvrir(AWA, corps({ openedAt: '2026-09-01T09:00:00.000Z' }));

    const [args] = db.ouvertureFiche.create.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data.openedAt).toEqual(new Date('2026-09-01T09:00:00.000Z'));
    expect(args.data.openedById).toBe(AWA.id);
  });

  // Le verrou est tenu par un index unique PARTIEL : la base refuse, et ce
  // refus est le comportement voulu, pas un incident.
  it('traduit le verrou de la base en 409, jamais en 500', async () => {
    db.ouvertureFiche.create.mockRejectedValue(violationUnicite());

    const echec = service.ouvrir(AWA, corps());
    await expect(echec).rejects.toBeInstanceOf(ConflictException);
    await expect(service.ouvrir(AWA, corps())).rejects.toMatchObject({
      response: { code: 'OUVERTURE_FICHE_DEJA_OUVERTE' },
    });
  });

  it('rejoue la même ouverture sans en compter une seconde', async () => {
    db.ouvertureFiche.findUnique.mockResolvedValue(ligne());

    const rejeu = await service.ouvrir(AWA, corps());

    expect(rejeu.id).toBe(OUVERTURE);
    expect(db.ouvertureFiche.create).not.toHaveBeenCalled();
  });

  it('refuse un identifiant déjà pris par un autre téléconseiller', async () => {
    db.ouvertureFiche.findUnique.mockResolvedValue(ligne({ openedById: 'com-omar' }));

    await expect(service.ouvrir(AWA, corps())).rejects.toMatchObject({
      response: { code: 'OUVERTURE_ID_PRIS' },
    });
  });
});

describe('le brouillon et la fiche en main', () => {
  it('rend la fiche ouverte avec ses réponses déjà saisies', async () => {
    db.ouvertureFiche.findFirst.mockResolvedValue(ligne({ draft: { syndicat: 'SUDES' } }));

    const courante = await service.courante(AWA);

    expect(courante?.draft).toEqual({ syndicat: 'SUDES' });
    expect(courante?.dureeSecondes).toBeNull();
  });

  it('n’écrit un brouillon que sur SA fiche, et seulement tant qu’elle est ouverte', async () => {
    db.ouvertureFiche.updateMany.mockResolvedValue({ count: 0 });
    db.ouvertureFiche.findUnique.mockResolvedValue(ligne({ openedById: 'com-omar' }));

    await expect(
      service.enregistrerBrouillon(AWA, OUVERTURE, { draft: { syndicat: 'SUDES' } }),
    ).rejects.toBeInstanceOf(NotFoundException);

    db.ouvertureFiche.findUnique.mockResolvedValue(
      ligne({ closedAt: new Date('2026-09-01T09:20:00.000Z') }),
    );
    await expect(
      service.enregistrerBrouillon(AWA, OUVERTURE, { draft: { syndicat: 'SUDES' } }),
    ).rejects.toMatchObject({ response: { code: 'OUVERTURE_DEJA_FERMEE' } });
  });

  it('lit la durée de traitement entre les deux bornes, sans la stocker', async () => {
    db.ouvertureFiche.findFirst.mockResolvedValue(
      ligne({ closedAt: new Date('2026-09-01T09:04:30.000Z') }),
    );

    expect((await service.courante(AWA))?.dureeSecondes).toBe(270);
  });
});

describe('la qualification lève le verrou', () => {
  it('ferme l’ouverture en y attachant la tentative', async () => {
    db.ouvertureFiche.findUnique.mockResolvedValue({ openedAt: new Date('2026-09-01T09:00:00Z') });

    await fermerOuverture(db as unknown as Prisma.TransactionClient, {
      ouvertureId: OUVERTURE,
      openedById: AWA.id,
      attemptId: 'att-1',
      at: new Date('2026-09-01T09:05:00.000Z'),
    });

    const [args] = db.ouvertureFiche.updateMany.mock.calls[0] as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ];
    expect(args.where).toMatchObject({ openedById: AWA.id, closedAt: null });
    expect(args.data).toEqual({
      closedAt: new Date('2026-09-01T09:05:00.000Z'),
      closingAttemptId: 'att-1',
    });
  });

  // `closedAt >= openedAt` est une contrainte CHECK : une horloge qui recule
  // avorterait la transaction de la tentative entière.
  it('ne descend jamais la fermeture sous l’ouverture', async () => {
    db.ouvertureFiche.findUnique.mockResolvedValue({ openedAt: new Date('2026-09-01T09:00:00Z') });

    await fermerOuverture(db as unknown as Prisma.TransactionClient, {
      ouvertureId: OUVERTURE,
      openedById: AWA.id,
      attemptId: 'att-1',
      at: new Date('2026-09-01T08:55:00.000Z'),
    });

    const [args] = db.ouvertureFiche.updateMany.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(args.data.closedAt).toEqual(new Date('2026-09-01T09:00:00.000Z'));
  });

  it('ignore une ouverture inconnue plutôt que de perdre la tentative', async () => {
    db.ouvertureFiche.findUnique.mockResolvedValue(null);

    await fermerOuverture(db as unknown as Prisma.TransactionClient, {
      ouvertureId: OUVERTURE,
      openedById: AWA.id,
      attemptId: 'att-1',
      at: new Date('2026-09-01T09:05:00.000Z'),
    });

    expect(db.ouvertureFiche.updateMany).not.toHaveBeenCalled();
  });
});

describe('libérer une fiche restée ouverte', () => {
  it('trace la libération et remet la fiche en file de rappel', async () => {
    db.ouvertureFiche.findUnique.mockResolvedValue(ligne());

    await service.liberer(FATOU, OUVERTURE);

    const [args] = db.ouvertureFiche.updateMany.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(args.data.releasedById).toBe(FATOU.id);
    expect(args.data.closedAt).toEqual(args.data.releasedAt);
    expect(args.data.closingAttemptId).toBeUndefined();

    const [rappel] = db.representant.update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(rappel.data.nextCallbackOrigine).toBe('AUTOMATIQUE');
    expect(rappel.data.nextCallbackAt).toEqual(args.data.closedAt);
  });

  it('remet un prospect libéré dans la file des rappels de son téléconseiller', async () => {
    db.ouvertureFiche.findUnique.mockResolvedValue(
      ligne({
        representantId: null,
        representant: null,
        prospectId: '0198e000-0000-7000-8000-000000000001',
        prospect: { nom: 'Ndiaye', prenom: 'Aminata' },
      }),
    );

    await service.liberer(FATOU, OUVERTURE);

    const [args] = db.scheduledCallback.createMany.mock.calls[0] as [
      { data: Record<string, unknown>[] },
    ];
    expect(args.data[0]).toMatchObject({
      assignedToId: AWA.id,
      sourceAttemptId: OUVERTURE,
    });
    expect(db.representant.update).not.toHaveBeenCalled();
  });

  it('refuse de libérer une fiche déjà qualifiée', async () => {
    db.ouvertureFiche.findUnique.mockResolvedValue(
      ligne({ closedAt: new Date('2026-09-01T09:20:00.000Z') }),
    );

    await expect(service.liberer(FATOU, OUVERTURE)).rejects.toMatchObject({
      response: { code: 'OUVERTURE_DEJA_FERMEE' },
    });
    expect(db.ouvertureFiche.updateMany).not.toHaveBeenCalled();
  });
});

describe('compter les fiches ouvertes', () => {
  const sql = (): string =>
    ((db.$queryRaw.mock.calls[0] as [TemplateStringsArray])[0] as unknown as string[]).join('?');

  it('borne un téléconseiller à son propre compte, quoi qu’il demande', async () => {
    await service.comptage(AWA, { openedById: 'com-omar' });

    const valeurs = (db.$queryRaw.mock.calls[0] as unknown[]).slice(1);
    expect(JSON.stringify(valeurs)).toContain(AWA.id);
    expect(JSON.stringify(valeurs)).not.toContain('com-omar');
  });

  it('groupe par téléconseiller et par journée de travail', async () => {
    await service.comptage(FATOU, {});

    expect(sql()).toContain(`date_trunc('day', o."openedAt")`);
    expect(sql()).toContain('GROUP BY 1, 2, 3');
  });
});
