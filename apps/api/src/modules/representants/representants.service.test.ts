import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ChangeSource, RepresentantRelation, Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { RepresentantsController } from './representants.controller.js';
import { RepresentantsService } from './representants.service.js';

type MockFn = ReturnType<typeof vi.fn>;

interface MockDb {
  representant: Record<
    'findFirst' | 'findMany' | 'findUnique' | 'count' | 'create' | 'update' | 'updateMany',
    MockFn
  >;
  representantRelationChange: Record<'create' | 'findMany', MockFn>;
  $transaction: MockFn;
}

const COMMERCIAL: AuthenticatedUser = {
  id: 'com-1',
  email: 'awa@cpi.sn',
  username: 'awa',
  fullName: 'Awa Diop',
  role: Role.COMMERCIAL,
};

const ADMIN: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Admin CPI',
  role: Role.ADMIN,
};

const date = new Date('2026-01-15T09:00:00.000Z');

const foreignRow = (): Record<string, unknown> => ({
  id: 'rep-9',
  fullName: 'Fatou Ndiaye',
  phoneE164: '+221771234567',
  notes: 'Rappeler après 16 h, établissement Almadies',
  rev: 1,
  departementId: 'dep-1',
  departement: { name: 'Dakar' },
  iefId: null,
  ief: null,
  createdById: 'com-2',
  createdBy: { id: 'com-2', fullName: 'Moussa Sarr' },
  clientCreatedAt: date,
  createdAt: date,
  updatedAt: date,
  relationStatus: RepresentantRelation.INCONNU,
  isDemo: false,
  _count: { prospects: 42 },
});

let db: MockDb;
let service: RepresentantsService;

beforeEach(() => {
  db = {
    representant: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(foreignRow()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    representantRelationChange: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn((run: (tx: MockDb) => Promise<unknown>) => run(db)),
  };
  service = new RepresentantsService(db as unknown as PrismaService, fakeDemoVisibility());
});

describe('lookup par téléphone', () => {
  it('ne divulgue QUE le nom du propriétaire sur la fiche d’un autre commercial', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());

    const result = await service.lookup(COMMERCIAL, '77 123 45 67');

    expect(result.found).toBe(true);
    expect(result.phoneE164).toBe('+221771234567');
    expect(result.ownedByCommercialName).toBe('Moussa Sarr');

    expect(result.representant).toBeNull();
    expect(result.ownedByCommercialId).toBeNull();
  });

  it('n’expose RIEN d’autre que found, phoneE164 et le nom du propriétaire', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());

    const result = await service.lookup(COMMERCIAL, '77 123 45 67');

    expect(Object.keys(result).sort()).toEqual(
      ['found', 'phoneE164', 'representant', 'ownedByCommercialId', 'ownedByCommercialName'].sort(),
    );

    const charge = JSON.stringify(result);
    for (const secret of [
      'Fatou Ndiaye',
      'Almadies',
      'Rappeler après 16 h',
      'rep-9',
      'com-2',
      'dep-1',
      'Dakar',
      '42',
    ]) {
      expect(charge, `« ${secret} » a fui hors du lookup`).not.toContain(secret);
    }

    expect(charge).toContain('Moussa Sarr');
  });

  it('rend la fiche complète quand elle appartient à l’appelant', async () => {
    db.representant.findFirst.mockResolvedValue({
      ...foreignRow(),
      createdById: COMMERCIAL.id,
      createdBy: { id: COMMERCIAL.id, fullName: COMMERCIAL.fullName },
    });

    const result = await service.lookup(COMMERCIAL, '77 123 45 67');

    expect(result.representant?.fullName).toBe('Fatou Ndiaye');
    expect(result.ownedByCommercialId).toBe(COMMERCIAL.id);
  });

  it('rend la fiche complète à un ADMIN : c’est lui qui arbitre les doublons', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());

    const result = await service.lookup(ADMIN, '77 123 45 67');

    expect(result.representant?.fullName).toBe('Fatou Ndiaye');
    expect(result.ownedByCommercialId).toBe('com-2');
  });

  it('répond « libre » sans erreur quand le numéro n’est pas pris', async () => {
    const result = await service.lookup(COMMERCIAL, '77 123 45 67');

    expect(result.found).toBe(false);
    expect(result.representant).toBeNull();
    expect(result.ownedByCommercialName).toBeNull();
  });

  it('applique la visibilité de démonstration', async () => {
    await service.lookup(COMMERCIAL, '77 123 45 67');

    const where = (
      db.representant.findFirst.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0].where;
    expect(where).toMatchObject({ isDemo: false });
  });
});

describe('conflit de téléphone à la création', () => {
  const input = {
    fullName: 'Awa Fall',
    phone: '77 123 45 67',
    departementId: 'dep-1',
  };

  it('ne divulgue QUE le nom du propriétaire dans le corps du 409', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());

    const error = await service.create(COMMERCIAL, input).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    const body = (error as { response: { existing: Record<string, unknown> } }).response;
    expect(body.existing).toEqual({
      phoneE164: '+221771234567',
      ownedByCommercialName: 'Moussa Sarr',
    });
  });

  it('rend le détail complet à un ADMIN', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());

    const error = await service.create(ADMIN, input).catch((caught: unknown) => caught);

    const body = (error as { response: { existing: Record<string, unknown> } }).response;
    expect(body.existing).toMatchObject({ id: 'rep-9', fullName: 'Fatou Ndiaye' });
  });

  it('cherche le conflit SANS portée de démonstration : l’unicité est globale', async () => {
    await service.create(COMMERCIAL, input).catch(() => undefined);

    const calls = db.representant.findFirst.mock.calls as [{ where: Record<string, unknown> }][];
    const conflictCall = calls.find((call) => 'phoneE164' in call[0].where);
    expect(conflictCall?.[0].where).toEqual({ phoneE164: '+221771234567', deletedAt: null });
  });
});

describe('cloisonnement de la route', () => {
  it('réserve tout le contrôleur aux commerciaux et aux administrateurs', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, RepresentantsController) as Role[] | undefined;

    expect(roles).toBeDefined();
    expect(roles).toContain(Role.COMMERCIAL);
    expect(roles).toContain(Role.ADMIN);
    expect(roles).not.toContain(Role.BANQUE_FINANCE);
  });

  it('resserre l’import de masse au seul ADMIN', () => {
    const handler = Object.getOwnPropertyDescriptor(RepresentantsController.prototype, 'import')
      ?.value as object;
    const roles = Reflect.getMetadata(ROLES_KEY, handler) as Role[];

    expect(roles).toEqual([Role.ADMIN]);
  });
});

describe('nature de la fiche créée', () => {
  const saisie = {
    fullName: 'Fatou Ndiaye',
    phone: '77 123 45 67',
    departementId: 'dep-1',
  };

  const dataOf = (): Record<string, unknown> =>
    (db.representant.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;

  beforeEach(() => {
    db.representant.create.mockResolvedValue(foreignRow());
  });

  it('mode ÉTEINT : la fiche est réelle', async () => {
    await new RepresentantsService(
      db as unknown as PrismaService,
      fakeDemoVisibility(false),
    ).create(COMMERCIAL, saisie);

    expect(dataOf().isDemo).toBe(false);
  });

  it('mode ALLUMÉ : la fiche est une fiche de démonstration', async () => {
    await new RepresentantsService(db as unknown as PrismaService, fakeDemoVisibility(true)).create(
      COMMERCIAL,
      saisie,
    );

    expect(dataOf().isDemo).toBe(true);
  });
});

describe('filtre par état de relation', () => {
  const whereOf = (): Record<string, unknown> =>
    (db.representant.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;

  it('ne retient que les fiches dans l’état demandé', async () => {
    await service.list(ADMIN, { relationStatus: RepresentantRelation.AMBASSADEUR });

    expect(whereOf().relationStatus).toBe(RepresentantRelation.AMBASSADEUR);
  });

  it('ne filtre sur rien quand l’état n’est pas demandé', async () => {
    await service.list(ADMIN, {});

    expect(whereOf()).not.toHaveProperty('relationStatus');
  });

  it('rend l’état de relation avec la fiche', async () => {
    db.representant.findFirst.mockResolvedValue({
      ...foreignRow(),
      relationStatus: RepresentantRelation.AMBASSADEUR,
    });

    await expect(service.get(ADMIN, 'rep-9')).resolves.toMatchObject({
      relationStatus: RepresentantRelation.AMBASSADEUR,
    });
  });

  it('laisse le cloisonnement du téléconseiller par-dessus le filtre', async () => {
    await service.list(COMMERCIAL, { relationStatus: RepresentantRelation.AMBASSADEUR });

    expect(whereOf()).toMatchObject({
      relationStatus: RepresentantRelation.AMBASSADEUR,
      createdById: COMMERCIAL.id,
    });
  });
});

describe('bascule de relation par le panel', () => {
  const own = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    ...foreignRow(),
    createdById: COMMERCIAL.id,
    createdBy: { id: COMMERCIAL.id, fullName: COMMERCIAL.fullName },
    ...over,
  });

  const historyOf = (): Record<string, unknown> =>
    (db.representantRelationChange.create.mock.calls[0]?.[0] as { data: Record<string, unknown> })
      .data;

  it('écrit la transition et son histoire, source WEB', async () => {
    db.representant.findFirst.mockResolvedValue(own());

    await service.update(COMMERCIAL, 'rep-9', {
      relationStatus: RepresentantRelation.AMBASSADEUR,
    });

    const guard = (
      db.representant.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ]
    )[0];
    expect(guard.where).toMatchObject({
      id: 'rep-9',
      relationStatus: RepresentantRelation.INCONNU,
    });
    expect(guard.data).toMatchObject({ relationStatus: RepresentantRelation.AMBASSADEUR });

    expect(historyOf()).toMatchObject({
      representantId: 'rep-9',
      fromStatus: RepresentantRelation.INCONNU,
      toStatus: RepresentantRelation.AMBASSADEUR,
      changedById: COMMERCIAL.id,
      source: ChangeSource.WEB,
      isDemo: false,
    });
  });

  it('n’écrit RIEN quand le statut posté est déjà le statut courant', async () => {
    db.representant.findFirst.mockResolvedValue(
      own({ relationStatus: RepresentantRelation.AMBASSADEUR }),
    );

    await service.update(COMMERCIAL, 'rep-9', {
      relationStatus: RepresentantRelation.AMBASSADEUR,
    });

    expect(db.representant.updateMany).not.toHaveBeenCalled();
    expect(db.representantRelationChange.create).not.toHaveBeenCalled();
  });

  it('n’écrit aucune histoire quand la garde sur le statut de départ ne passe pas', async () => {
    db.representant.findFirst.mockResolvedValue(own());
    db.representant.updateMany.mockResolvedValue({ count: 0 });

    await service.update(COMMERCIAL, 'rep-9', { relationStatus: RepresentantRelation.REFUS });

    expect(db.representantRelationChange.create).not.toHaveBeenCalled();
  });

  it('laisse la relation tranquille quand la modification ne la mentionne pas', async () => {
    db.representant.findFirst.mockResolvedValue(own());

    await service.update(COMMERCIAL, 'rep-9', { fullName: 'Fatou Ndiaye Sow' });

    expect(db.representant.updateMany).not.toHaveBeenCalled();
    expect(db.representantRelationChange.create).not.toHaveBeenCalled();
  });

  it('fait suivre la trace la nature de la fiche, pas le mode en vigueur', async () => {
    db.representant.findFirst.mockResolvedValue(own({ isDemo: true }));

    await new RepresentantsService(db as unknown as PrismaService, fakeDemoVisibility(true)).update(
      COMMERCIAL,
      'rep-9',
      { relationStatus: RepresentantRelation.CONTACTE },
    );

    expect(historyOf().isDemo).toBe(true);
  });
});

describe('historique de relation', () => {
  it('refuse la fiche d’un autre téléconseiller', async () => {
    db.representant.findFirst.mockResolvedValue({ id: 'rep-9', createdById: 'com-2' });

    await expect(service.relationHistory(COMMERCIAL, 'rep-9')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.representantRelationChange.findMany).not.toHaveBeenCalled();
  });

  it('rend les bascules de la fiche, de la plus récente à la plus ancienne', async () => {
    db.representant.findFirst.mockResolvedValue({ id: 'rep-9', createdById: COMMERCIAL.id });
    db.representantRelationChange.findMany.mockResolvedValue([
      {
        id: 'chg-2',
        representantId: 'rep-9',
        fromStatus: RepresentantRelation.CONTACTE,
        toStatus: RepresentantRelation.AMBASSADEUR,
        reason: null,
        changedById: COMMERCIAL.id,
        changedBy: { fullName: COMMERCIAL.fullName },
        source: ChangeSource.WEB,
        changedAt: date,
      },
    ]);

    const result = await service.relationHistory(COMMERCIAL, 'rep-9');

    expect(result.items).toEqual([
      {
        id: 'chg-2',
        representantId: 'rep-9',
        fromStatus: RepresentantRelation.CONTACTE,
        toStatus: RepresentantRelation.AMBASSADEUR,
        reason: null,
        changedById: COMMERCIAL.id,
        changedByName: COMMERCIAL.fullName,
        source: ChangeSource.WEB,
        changedAt: date.toISOString(),
      },
    ]);

    const args = db.representantRelationChange.findMany.mock.calls[0]?.[0] as {
      orderBy: unknown[];
    };
    expect(args.orderBy).toEqual([{ changedAt: 'desc' }, { id: 'desc' }]);
  });

  it('rend une liste vide sans erreur quand la relation n’a jamais bougé', async () => {
    db.representant.findFirst.mockResolvedValue({ id: 'rep-9', createdById: COMMERCIAL.id });

    await expect(service.relationHistory(ADMIN, 'rep-9')).resolves.toEqual({ items: [] });
  });
});

describe('lecture du SUPERVISEUR', () => {
  const SUPERVISEUR: AuthenticatedUser = {
    id: 'sup-1',
    email: 'sup@cpi.sn',
    username: 'sup',
    fullName: 'Awa Sy',
    role: Role.SUPERVISEUR,
  };

  const whereOf = (): Record<string, unknown> =>
    (db.representant.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;

  it('liste l’annuaire national', async () => {
    await service.list(SUPERVISEUR, {});

    expect(whereOf().createdById).toBeUndefined();
  });

  it('son filtre par téléconseiller RÉPOND, au lieu de rendre zéro ligne', async () => {
    await service.list(SUPERVISEUR, { commercialId: 'com-2' });

    expect(whereOf().createdById).toBe('com-2');
  });

  it('ouvre la fiche d’autrui, et son historique de relation', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());

    await expect(service.get(SUPERVISEUR, 'rep-9')).resolves.toMatchObject({ id: 'rep-9' });
    await expect(service.relationHistory(SUPERVISEUR, 'rep-9')).resolves.toMatchObject({
      items: [],
    });
  });

  it('n’écrit rien : la modification lui est refusée comme à un tiers', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());

    await expect(service.update(SUPERVISEUR, 'rep-9', { notes: 'vu' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.remove(SUPERVISEUR, 'rep-9', { cascade: true })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
