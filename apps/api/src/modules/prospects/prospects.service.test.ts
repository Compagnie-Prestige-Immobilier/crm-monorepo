import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { ProspectsService } from './prospects.service.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

const alice: AuthenticatedUser = {
  id: 'com-alice',
  email: 'alice@cpi.sn',
  username: 'alice',
  fullName: 'Alice Diop',
  role: Role.COMMERCIAL,
};
const bob: AuthenticatedUser = { ...alice, id: 'com-bob', username: 'bob', fullName: 'Bob Sarr' };
const admin: AuthenticatedUser = { ...alice, id: 'admin-1', username: 'admin', role: Role.ADMIN };

interface PrismaMock {
  prospect: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  representant: { findFirst: ReturnType<typeof vi.fn> };
  user: { findFirst: ReturnType<typeof vi.fn> };
  $queryRaw: ReturnType<typeof vi.fn>;
}

function makePrisma(): PrismaMock {
  return {
    prospect: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    representant: { findFirst: vi.fn().mockResolvedValue(null) },
    user: { findFirst: vi.fn().mockResolvedValue(null) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

interface PrismaCallArgs {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

function firstArg(fn: ReturnType<typeof vi.fn>): PrismaCallArgs {
  return (fn.mock.calls[0]?.[0] ?? {}) as PrismaCallArgs;
}

const service = (prisma: PrismaMock): ProspectsService =>
  new ProspectsService(prisma as unknown as PrismaService, fakeDemoVisibility());

describe('cloisonnement par commercial', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('la liste d’un COMMERCIAL est bornée à ses propres lignes, dans le WHERE', async () => {
    await service(prisma).list(alice, {});

    const where = firstArg(prisma.prospect.findMany).where ?? {};
    expect(where.createdById).toBe('com-alice');
    expect(firstArg(prisma.prospect.count).where).toEqual(where);
  });

  it('un COMMERCIAL qui filtre sur un collègue obtient l’ensemble vide, pas ses lignes', async () => {
    await service(prisma).list(alice, { commercialId: 'com-bob' });

    const where = firstArg(prisma.prospect.findMany).where ?? {};
    expect(where.createdById).not.toBe('com-bob');
    expect(where.createdById).toBe('__aucun__');
  });

  it('un ADMIN n’est pas borné', async () => {
    await service(prisma).list(admin, {});
    const where = firstArg(prisma.prospect.findMany).where ?? {};
    expect(where.createdById).toBeUndefined();
  });

  it('un ADMIN peut cibler un commercial précis', async () => {
    await service(prisma).list(admin, { commercialId: 'com-bob' });
    const where = firstArg(prisma.prospect.findMany).where ?? {};
    expect(where.createdById).toBe('com-bob');
  });

  it('exclut par défaut les fiches supprimées logiquement', async () => {
    await service(prisma).list(alice, {});
    const where = firstArg(prisma.prospect.findMany).where ?? {};
    expect(where.deletedAt).toBeNull();
  });

  it('un COMMERCIAL ne peut pas demander les fiches supprimées', async () => {
    await service(prisma).list(alice, { includeDeleted: true });
    const where = firstArg(prisma.prospect.findMany).where ?? {};
    expect(where.deletedAt).toBeNull();
  });

  it('un COMMERCIAL ne peut pas lire le prospect d’un autre commercial', async () => {
    prisma.prospect.findFirst.mockResolvedValue({ id: 'p-1', createdById: bob.id });

    await expect(service(prisma).get(alice, 'p-1')).rejects.toThrow(ForbiddenException);
  });

  it('un COMMERCIAL ne peut pas modifier le prospect d’un autre commercial', async () => {
    prisma.prospect.findFirst.mockResolvedValue({ id: 'p-1', createdById: bob.id });

    await expect(service(prisma).update(alice, 'p-1', { nom: 'Pirate' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.prospect.update).not.toHaveBeenCalled();
  });

  it('un COMMERCIAL ne peut pas supprimer le prospect d’un autre commercial', async () => {
    prisma.prospect.findFirst.mockResolvedValue({ id: 'p-1', createdById: bob.id });

    await expect(service(prisma).remove(alice, 'p-1')).rejects.toThrow(ForbiddenException);
    expect(prisma.prospect.update).not.toHaveBeenCalled();
  });

  it('un ADMIN lit la fiche de n’importe quel commercial', async () => {
    prisma.prospect.findFirst.mockResolvedValue(prospectRow({ createdById: bob.id }));
    await expect(service(prisma).get(admin, 'p-1')).resolves.toMatchObject({ id: 'p-1' });
  });

  it('la réaffectation ne peut porter que sur les lignes de l’appelant', async () => {
    prisma.prospect.findMany.mockResolvedValue([]);
    prisma.representant.findFirst.mockResolvedValue({ id: 'r-1', createdById: alice.id });

    await service(prisma).reassign(alice, { prospectIds: ['p-1', 'p-2'], representantId: 'r-1' });

    const where = firstArg(prisma.prospect.findMany).where ?? {};
    expect(where.createdById).toBe('com-alice');
  });

  it('seul un ADMIN peut changer le commercial propriétaire', async () => {
    await expect(
      service(prisma).reassign(alice, { prospectIds: ['p-1'], commercialId: 'com-bob' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('un COMMERCIAL ne peut pas rattacher un prospect au représentant d’un collègue', async () => {
    prisma.prospect.findUnique.mockResolvedValue(null);
    prisma.representant.findFirst.mockResolvedValue({ id: 'r-bob', createdById: bob.id });

    await expect(
      service(prisma).create(alice, {
        nom: 'Ndiaye',
        prenom: 'Awa',
        phone: '77 123 45 67',
        banqueId: 'b-1',
        syndicatId: 's-1',
        representantId: 'r-bob',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.prospect.create).not.toHaveBeenCalled();
  });
});

describe('conflit de téléphone', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.representant.findFirst.mockResolvedValue({ id: 'r-1', createdById: alice.id });
  });

  it('renvoie un 409 nommant la fiche existante ET son commercial', async () => {
    prisma.prospect.findFirst.mockResolvedValue({
      id: 'p-existant',
      nom: 'Fall',
      prenom: 'Moussa',
      createdAt: new Date('2026-08-01T09:30:00.000Z'),
      createdBy: { id: 'com-bob', fullName: 'Bob Sarr' },
      representant: { id: 'r-9', fullName: 'Cheikh Ba' },
    });

    const promise = service(prisma).create(alice, {
      nom: 'Fall',
      prenom: 'Moussa',
      phone: '77 123 45 67',
      banqueId: 'b-1',
      syndicatId: 's-1',
      representantId: 'r-1',
    });

    await expect(promise).rejects.toThrow(ConflictException);
    try {
      await promise;
    } catch (error) {
      expect((error as ConflictException).getResponse()).toEqual({
        code: 'PROSPECT_PHONE_CONFLICT',
        message: 'Ce numéro a déjà été enregistré par Bob Sarr.',
        existing: {
          id: 'p-existant',
          nom: 'Fall',
          prenom: 'Moussa',
          representantId: 'r-9',
          representantName: 'Cheikh Ba',
          ownedByCommercialId: 'com-bob',
          ownedByCommercialName: 'Bob Sarr',
          createdAt: '2026-08-01T09:30:00.000Z',
        },
      });
    }
  });

  it('cherche le doublon sur le numéro NORMALISÉ, pas sur la saisie brute', async () => {
    prisma.prospect.findFirst.mockResolvedValue(null);
    prisma.prospect.create.mockResolvedValue(prospectRow({}));

    await service(prisma).create(alice, {
      nom: 'Fall',
      prenom: 'Moussa',
      phone: '00221 77 123 45 67',
      banqueId: 'b-1',
      syndicatId: 's-1',
      representantId: 'r-1',
    });

    const where = firstArg(prisma.prospect.findFirst).where ?? {};
    expect(where.phoneE164).toBe('+221771234567');
    expect(firstArg(prisma.prospect.create).data?.phoneE164).toBe('+221771234567');
  });

  it('ne compte pas les fiches supprimées comme des doublons', async () => {
    prisma.prospect.findFirst.mockResolvedValue(null);
    prisma.prospect.create.mockResolvedValue(prospectRow({}));

    await service(prisma).create(alice, {
      nom: 'Fall',
      prenom: 'Moussa',
      phone: '771234567',
      banqueId: 'b-1',
      syndicatId: 's-1',
      representantId: 'r-1',
    });

    const where = firstArg(prisma.prospect.findFirst).where ?? {};
    expect(where.deletedAt).toBeNull();
  });
});

describe('garde anti-squat d’identifiant', () => {
  it('refuse en 403 un identifiant déjà pris par un autre commercial, jamais d’écrasement', async () => {
    const prisma = makePrisma();
    prisma.prospect.findUnique.mockResolvedValue({ id: 'p-1', createdById: bob.id });

    await expect(
      service(prisma).create(alice, {
        id: 'p-1',
        nom: 'X',
        prenom: 'Y',
        phone: '771234567',
        banqueId: 'b-1',
        syndicatId: 's-1',
        representantId: 'r-1',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.prospect.create).not.toHaveBeenCalled();
  });

  it('refuse en 409 son propre identifiant déjà utilisé', async () => {
    const prisma = makePrisma();
    prisma.prospect.findUnique.mockResolvedValue({ id: 'p-1', createdById: alice.id });

    await expect(
      service(prisma).create(alice, {
        id: 'p-1',
        nom: 'X',
        prenom: 'Y',
        phone: '771234567',
        banqueId: 'b-1',
        syndicatId: 's-1',
        representantId: 'r-1',
      }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('fusion', () => {
  it('refuse de fusionner une fiche avec elle-même', async () => {
    const prisma = makePrisma();
    await expect(
      service(prisma).merge(alice, { targetId: 'p-1', sourceId: 'p-1' }),
    ).rejects.toThrow(/elle-même/);
  });

  it('refuse quand l’une des deux fiches est introuvable', async () => {
    const prisma = makePrisma();
    prisma.prospect.findFirst.mockResolvedValue(null);
    await expect(
      service(prisma).merge(alice, { targetId: 'p-1', sourceId: 'p-2' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('surface de phase 2 dans la liste', () => {
  const DATE = new Date('2026-08-05T10:00:00.000Z');

  const MATRICE = [
    { id: 'p-b1', sigle: 'CHUES', shortName: 'CBAO', segment: 'BDD1' },
    { id: 'p-b2', sigle: 'CHUES', shortName: 'BHS', segment: 'BDD2' },
    { id: 'p-b3', sigle: 'SAES', shortName: 'CBAO', segment: 'BDD3' },
    { id: 'p-b4', sigle: 'SAES', shortName: 'BHS', segment: 'BDD4' },
  ] as const;

  it('calcule le segment de chaque ligne au lieu de le lire en base', async () => {
    const prisma = makePrisma();
    prisma.prospect.count.mockResolvedValue(MATRICE.length);
    prisma.prospect.findMany.mockResolvedValue(
      MATRICE.map((entry) =>
        prospectRow({
          id: entry.id,
          syndicat: { sigle: entry.sigle },
          banque: { name: `Banque ${entry.shortName}`, shortName: entry.shortName },
        }),
      ),
    );

    const page = await service(prisma).list(admin, {});

    expect(page.items.map((item) => [item.id, item.segment])).toEqual(
      MATRICE.map((entry) => [entry.id, entry.segment]),
    );
    expect(firstArg(prisma.prospect.findMany).where?.segment).toBeUndefined();
  });

  it('rend la méthode, son auteur, sa date et le dernier résultat d’appel', async () => {
    const prisma = makePrisma();
    prisma.prospect.count.mockResolvedValue(1);
    prisma.prospect.findMany.mockResolvedValue([
      prospectRow({
        phase2Status: 'METHOD_OBTAINED',
        enrollmentMethod: 'PLATFORM',
        enrollmentCapturedAt: DATE,
        enrollmentCapturedById: 'com-bob',
        enrollmentCapturedBy: { id: 'com-bob', fullName: 'Bob Sarr' },
      }),
    ]);
    prisma.$queryRaw.mockResolvedValue([
      { prospectId: 'p-1', outcome: 'METHOD_OBTAINED', comment: 'Accepte la plateforme', at: DATE },
    ]);

    const [item] = (await service(prisma).list(admin, {})).items;

    expect(item).toMatchObject({
      phase2Status: 'METHOD_OBTAINED',
      enrollmentMethod: 'PLATFORM',
      enrollmentCapturedById: 'com-bob',
      enrollmentCapturedByName: 'Bob Sarr',
      enrollmentCapturedAt: DATE.toISOString(),
      lastOutcome: 'METHOD_OBTAINED',
      lastComment: 'Accepte la plateforme',
      lastAttemptAt: DATE.toISOString(),
      ownedByCommercialId: alice.id,
    });
  });

  it('rend la provenance stockée, clé et détail lisible', async () => {
    const prisma = makePrisma();
    prisma.prospect.count.mockResolvedValue(2);
    prisma.prospect.findMany.mockResolvedValue([
      prospectRow({ id: 'p-banque', origin: 'BANQUE', originLabel: 'CBAO Thiès' }),
      prospectRow({ id: 'p-terrain' }),
    ]);

    const { items } = await service(prisma).list(admin, {});

    expect(items[0]).toMatchObject({ origin: 'BANQUE', originLabel: 'CBAO Thiès' });
    expect(items[1]).toMatchObject({ origin: null, originLabel: null });
    expect(Object.keys(items[1] ?? {})).toContain('origin');
  });

  it('laisse à null les champs de phase 2 d’une fiche jamais appelée', async () => {
    const prisma = makePrisma();
    prisma.prospect.count.mockResolvedValue(1);
    prisma.prospect.findMany.mockResolvedValue([prospectRow({})]);

    const [item] = (await service(prisma).list(admin, {})).items;

    expect(item).toMatchObject({
      phase2Status: 'PENDING',
      enrollmentMethod: null,
      enrollmentCapturedByName: null,
      lastOutcome: null,
      lastComment: null,
      lastAttemptAt: null,
    });
  });

  it('lit les dernières tentatives en UNE requête, quel que soit le nombre de lignes', async () => {
    const prisma = makePrisma();
    const rows = Array.from({ length: 25 }, (_unused, index) =>
      prospectRow({ id: `p-${String(index)}` }),
    );
    prisma.prospect.count.mockResolvedValue(rows.length);
    prisma.prospect.findMany.mockResolvedValue(rows);

    await service(prisma).list(admin, { pageSize: 25 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('n’interroge pas les tentatives quand la page est vide', async () => {
    const prisma = makePrisma();
    await service(prisma).list(admin, {});
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('transmet les filtres de phase 2 au WHERE, cloisonnement compris', async () => {
    const prisma = makePrisma();
    await service(prisma).list(alice, {
      segment: 'BDD1',
      phase2Status: 'METHOD_OBTAINED',
      enrollmentMethod: 'PLATFORM',
      enrollmentCapturedById: 'com-bob',
      campaignId: 'camp-1',
    });

    const where = firstArg(prisma.prospect.findMany).where ?? {};
    expect(where).toMatchObject({
      createdById: 'com-alice',
      phase2Status: 'METHOD_OBTAINED',
      enrollmentMethod: 'PLATFORM',
      enrollmentCapturedById: 'com-bob',
    });
    expect(where.AND).toEqual([
      { syndicat: { sigle: 'CHUES' }, banque: { shortName: 'CBAO' } },
      { callTasks: { some: { campaignId: 'camp-1' } } },
    ]);
    expect(firstArg(prisma.prospect.count).where).toEqual(where);
  });
});

function prospectRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'p-1',
    nom: 'Fall',
    prenom: 'Moussa',
    phoneE164: '+221771234567',
    rev: 1,
    statut: 'NOUVEAU',
    banqueId: 'b-1',
    syndicatId: 's-1',
    representantId: 'r-1',
    createdById: alice.id,
    clientCreatedAt: new Date('2026-08-01T09:00:00.000Z'),
    createdAt: new Date('2026-08-01T09:00:00.000Z'),
    updatedAt: new Date('2026-08-01T09:00:00.000Z'),
    deletedAt: null,
    phase2Status: 'PENDING',
    origin: null,
    originLabel: null,
    enrollmentMethod: null,
    enrollmentCapturedAt: null,
    enrollmentCapturedById: null,
    enrollmentCapturedBy: null,
    banque: { name: 'CBAO Sénégal', shortName: 'CBAO' },
    syndicat: { sigle: 'SUDES' },
    createdBy: { id: alice.id, fullName: alice.fullName },
    representant: {
      fullName: 'Cheikh Ba',
      phoneE164: '+221770000000',
      departementId: 'd-1',
      departement: { name: 'Dakar' },
    },
    ...overrides,
  };
}

describe('nature de la fiche créée', () => {
  const saisie = {
    nom: 'Fall',
    prenom: 'Moussa',
    phone: '77 123 45 67',
    banqueId: 'b-1',
    syndicatId: 's-1',
    representantId: 'r-1',
  };

  const prepare = (representantIsDemo: boolean): PrismaMock => {
    const prisma = makePrisma();
    prisma.representant.findFirst.mockResolvedValue({
      id: 'r-1',
      createdById: alice.id,
      isDemo: representantIsDemo,
    });
    prisma.prospect.create.mockResolvedValue(prospectRow({}));
    return prisma;
  };

  it('mode ÉTEINT et représentant réel : la fiche est réelle', async () => {
    const prisma = prepare(false);
    await new ProspectsService(
      prisma as unknown as PrismaService,
      fakeDemoVisibility(false),
    ).create(alice, saisie);

    expect(firstArg(prisma.prospect.create).data?.isDemo).toBe(false);
  });

  it('mode ALLUMÉ : la fiche est une fiche de démonstration', async () => {
    const prisma = prepare(false);
    await new ProspectsService(prisma as unknown as PrismaService, fakeDemoVisibility(true)).create(
      alice,
      saisie,
    );

    expect(firstArg(prisma.prospect.create).data?.isDemo).toBe(true);
  });

  it('représentant de démonstration : la fiche le suit, mode éteint compris', async () => {
    const prisma = prepare(true);
    await new ProspectsService(
      prisma as unknown as PrismaService,
      fakeDemoVisibility(false),
    ).create(alice, saisie);

    expect(firstArg(prisma.prospect.create).data?.isDemo).toBe(true);
  });

  it('lit la nature du représentant, elle ne peut pas être devinée après coup', async () => {
    const prisma = prepare(true);
    await new ProspectsService(
      prisma as unknown as PrismaService,
      fakeDemoVisibility(false),
    ).create(alice, saisie);

    const select = (
      prisma.representant.findFirst.mock.calls[0]?.[0] as { select?: Record<string, unknown> }
    ).select;
    expect(select?.isDemo).toBe(true);
  });
});
