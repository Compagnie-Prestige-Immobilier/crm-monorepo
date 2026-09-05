import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GrandPublicConsent, Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { ProspectsService } from './prospects.service.js';

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
  prospectJourney: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  prospectConversion: { upsert: ReturnType<typeof vi.fn> };
  callAttempt: { findMany: ReturnType<typeof vi.fn> };
  ouvertureFiche: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
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
    prospectJourney: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    prospectConversion: { upsert: vi.fn() },
    callAttempt: { findMany: vi.fn().mockResolvedValue([]) },
    ouvertureFiche: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

interface PrismaCallArgs {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  update?: Record<string, unknown>;
}

function firstArg(fn: ReturnType<typeof vi.fn>): PrismaCallArgs {
  return (fn.mock.calls[0]?.[0] ?? {}) as PrismaCallArgs;
}

const service = (prisma: PrismaMock): ProspectsService =>
  new ProspectsService(prisma as unknown as PrismaService);

describe('cloisonnement par commercial', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
  });

  const PORTEE_ALICE = {
    OR: [{ createdById: 'com-alice' }, { lotItems: { some: { assigneeId: 'com-alice' } } }],
  };

  it('la liste d’un COMMERCIAL porte SES fiches ET celles qu’on lui a confiées', async () => {
    await service(prisma).list(alice, {});

    const where = firstArg(prisma.prospect.findMany).where ?? {};
    expect(where.AND).toEqual([PORTEE_ALICE]);
    expect(where.createdById).toBeUndefined();
    expect(firstArg(prisma.prospect.count).where).toEqual(where);
  });

  it('un COMMERCIAL qui filtre sur un collègue reste borné à ce qu’il a en main', async () => {
    await service(prisma).list(alice, { commercialId: 'com-bob' });

    const where = firstArg(prisma.prospect.findMany).where ?? {};
    expect(where.createdById).toBe('com-bob');
    expect(where.AND).toEqual([PORTEE_ALICE]);
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

  it('un COMMERCIAL peut lire le prospect d’un autre commercial', async () => {
    prisma.prospect.findFirst.mockResolvedValue(prospectRow({ createdById: bob.id }));
    await expect(service(prisma).get(alice, 'p-1')).resolves.toMatchObject({ id: 'p-1' });
  });

  it('ouvre la fiche qu’une campagne lui a confiée, comme sur son téléphone', async () => {
    prisma.prospect.findFirst.mockResolvedValue(prospectRow({ createdById: admin.id }));

    await expect(service(prisma).get(alice, 'p-1')).resolves.toMatchObject({ id: 'p-1' });
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

  it('réaffecte aussi la nature de la fiche au représentant de démonstration', async () => {
    prisma.prospect.findMany.mockResolvedValue([{ id: 'p-1' }]);
    prisma.representant.findFirst.mockResolvedValue({
      id: 'r-demo',
      createdById: admin.id,
    });

    await service(prisma).reassign(admin, { prospectIds: ['p-1'], representantId: 'r-demo' });

    const data = firstArg(prisma.prospect.updateMany).data ?? {};
    expect(data.representantId).toBe('r-demo');
    expect(data).not.toHaveProperty('isDemo');
  });

  it('seul un ADMIN peut changer le commercial propriétaire', async () => {
    await expect(
      service(prisma).reassign(alice, { prospectIds: ['p-1'], commercialId: 'com-bob' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('un COMMERCIAL rattache son prospect au représentant d’un collègue, l’annuaire étant commun', async () => {
    prisma.prospect.findUnique.mockResolvedValue(null);
    prisma.representant.findFirst.mockResolvedValue({ id: 'r-bob', createdById: bob.id });
    prisma.prospect.create.mockResolvedValue(prospectRow({}));

    await service(prisma).create(alice, {
      nom: 'Ndiaye',
      prenom: 'Awa',
      phone: '77 123 45 67',
      banqueId: 'b-1',
      syndicatId: 's-1',
      representantId: 'r-bob',
    });

    const data = firstArg(prisma.prospect.create).data ?? {};
    expect(data.representantId).toBe('r-bob');
    // La fiche créée reste celle de son auteur : c'est là qu'est le cloisonnement.
    expect(data.createdById).toBe(alice.id);
  });
});

describe('conflit de téléphone', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.representant.findFirst.mockResolvedValue({ id: 'r-1', createdById: alice.id });
  });

  const clashDe = (createdById: string): Record<string, unknown> => ({
    id: 'p-existant',
    nom: 'Fall',
    prenom: 'Moussa',
    createdById,
    createdAt: new Date('2026-08-01T09:30:00.000Z'),
    createdBy: { id: createdById, fullName: createdById === alice.id ? 'Alice Diop' : 'Bob Sarr' },
    representant: { id: 'r-9', fullName: 'Cheikh Ba' },
    // Un parcours déjà ouvert sur ce projet : sinon `attachProjectByPhone`
    // rattache la fiche et il n'y a pas de conflit à observer.
    journeys: [{ id: 'j-1' }],
  });

  const creation = (user: AuthenticatedUser): Promise<unknown> =>
    service(prisma).create(user, {
      nom: 'Fall',
      prenom: 'Moussa',
      phone: '77 123 45 67',
      banqueId: 'b-1',
      syndicatId: 's-1',
      representantId: 'r-1',
    });

  const bodyOf = async (promise: Promise<unknown>): Promise<unknown> => {
    try {
      await promise;
    } catch (error) {
      return (error as ConflictException).getResponse();
    }
    throw new Error('aucun conflit levé');
  };

  it('renvoie un 409 nommant la fiche existante ET son commercial, à son propriétaire', async () => {
    prisma.prospect.findFirst.mockResolvedValue(clashDe(alice.id));

    expect(await bodyOf(creation(alice))).toEqual({
      code: 'PROSPECT_PHONE_CONFLICT',
      message: 'Ce numéro a déjà été enregistré par Alice Diop.',
      existing: {
        id: 'p-existant',
        nom: 'Fall',
        prenom: 'Moussa',
        representantId: 'r-9',
        representantName: 'Cheikh Ba',
        ownedByCommercialId: alice.id,
        ownedByCommercialName: 'Alice Diop',
        createdAt: '2026-08-01T09:30:00.000Z',
      },
    });
  });

  /// Le contrôle est GLOBAL (l'index unique l'est) : sans cette réserve, boucler
  /// sur les numéros sénégalais rendait l'identité civile de tout le fichier.
  it('sur la fiche d’un collègue, ne rend que le nom du propriétaire', async () => {
    prisma.prospect.findFirst.mockResolvedValue(clashDe('com-bob'));

    expect(await bodyOf(creation(alice))).toEqual({
      code: 'PROSPECT_PHONE_CONFLICT',
      message: 'Ce numéro a déjà été enregistré par Bob Sarr.',
      existing: { ownedByCommercialName: 'Bob Sarr' },
    });
  });

  it('un ADMIN garde la fiche entière', async () => {
    prisma.prospect.findFirst.mockResolvedValue(clashDe('com-bob'));

    expect(await bodyOf(creation(admin))).toMatchObject({
      existing: { id: 'p-existant', nom: 'Fall' },
    });
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
      {
        prospectId: 'p-1',
        outcome: 'METHOD_OBTAINED',
        comment: 'Accepte la plateforme',
        at: DATE,
        count: 4n,
      },
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
      callAttemptCount: 4,
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
    });

    const where = firstArg(prisma.prospect.findMany).where ?? {};
    expect(where).toMatchObject({
      phase2Status: 'METHOD_OBTAINED',
      enrollmentMethod: 'PLATFORM',
      enrollmentCapturedById: 'com-bob',
    });
    expect(where.AND).toEqual([
      { OR: [{ createdById: 'com-alice' }, { lotItems: { some: { assigneeId: 'com-alice' } } }] },
      { syndicat: { sigle: 'CHUES' }, banque: { shortName: 'CBAO' } },
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
    // `journeys` est dans l'include partagé : une doublure qui l'omet ne
    // ressemble à aucune ligne que Prisma rend vraiment.
    journeys: [],
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

  const prepare = (): PrismaMock => {
    const prisma = makePrisma();
    prisma.representant.findFirst.mockResolvedValue({
      id: 'r-1',
      createdById: alice.id,
    });
    prisma.prospect.create.mockResolvedValue(prospectRow({}));
    return prisma;
  };

  it('valide le représentant avant de créer la fiche', async () => {
    const prisma = prepare();
    await new ProspectsService(prisma as unknown as PrismaService).create(alice, saisie);

    expect(prisma.representant.findFirst).toHaveBeenCalledTimes(1);
  });
});

// Corriger une fiche, c'est aussi retirer ce qu'on y avait mis par erreur :
// sans `null`, un employeur ou un pays saisi à tort restait pour toujours.
describe('effacement d’un champ de situation', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.prospect.findFirst.mockResolvedValue(prospectRow({ createdById: alice.id }));
    prisma.prospect.update.mockResolvedValue(prospectRow({ createdById: alice.id }));
  });

  it('« null » vide la colonne, sans toucher aux champs absents', async () => {
    await service(prisma).update(alice, 'p-1', {
      employeurId: null,
      employeur: null,
      paysResidenceId: null,
      whatsappE164: null,
      relaisPhoneE164: null,
      banqueId: null,
    });

    const data = firstArg(prisma.prospect.update).data ?? {};
    expect(data).toMatchObject({
      employeurId: null,
      employeur: null,
      paysResidenceId: null,
      whatsappE164: null,
      relaisPhoneE164: null,
      banqueId: null,
    });
    expect(data).not.toHaveProperty('syndicatId');
  });

  it('un numéro renseigné est toujours normalisé', async () => {
    await service(prisma).update(alice, 'p-1', { whatsappE164: '77 123 45 67' });

    expect(firstArg(prisma.prospect.update).data?.whatsappE164).toBe('+221771234567');
  });
});

describe('lecture du SUPERVISEUR', () => {
  const superviseur: AuthenticatedUser = {
    ...alice,
    id: 'sup-1',
    username: 'sup',
    role: Role.SUPERVISEUR,
  };

  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('sa liste porte sur le portefeuille national', async () => {
    await service(prisma).list(superviseur, {});

    expect(firstArg(prisma.prospect.findMany).where?.createdById).toBeUndefined();
  });

  it('son filtre par téléconseiller RÉPOND, au lieu de rendre zéro ligne', async () => {
    await service(prisma).list(superviseur, { commercialId: 'com-bob' });

    expect(firstArg(prisma.prospect.findMany).where?.createdById).toBe('com-bob');
  });

  it('ouvre la fiche d’un téléconseiller, sans borner la lecture sur lui-même', async () => {
    prisma.prospect.findFirst.mockResolvedValue(prospectRow({ createdById: bob.id }));

    await expect(service(prisma).get(superviseur, 'p-1')).resolves.toMatchObject({ id: 'p-1' });
    expect(firstArg(prisma.prospect.findFirst).where).not.toHaveProperty('OR');
  });

  it('relit les appels d’une fiche, avec leur auteur et leur motif', async () => {
    const DATE = new Date('2026-08-05T10:00:00.000Z');
    prisma.prospect.findFirst.mockResolvedValue(prospectRow({ createdById: bob.id }));
    prisma.callAttempt.findMany.mockResolvedValue([
      {
        id: 'att-1',
        outcome: 'METHOD_OBTAINED',
        reason: { label: 'Méthode obtenue' },
        method: 'PLATFORM',
        comment: null,
        email: 'a@b.sn',
        fonctionnaire: true,
        engagementEnCours: null,
        dureeEtablissementMois: 24,
        rendezVousAt: null,
        performedById: bob.id,
        performedBy: { fullName: 'Bob Sarr' },
        deviceCallType: 'sortant',
        deviceCallDurationSeconds: 92,
        deviceCallAt: new Date('2026-08-05T10:00:14.000Z'),
        clientCreatedAt: DATE,
      },
    ]);

    prisma.ouvertureFiche.findMany.mockResolvedValue([
      {
        closingAttemptId: 'att-1',
        firstInputAt: new Date('2026-08-05T10:00:00.000Z'),
        closedAt: new Date('2026-08-05T10:03:20.000Z'),
      },
    ]);

    const result = await service(prisma).callHistory(superviseur, 'p-1');

    expect(result.items).toEqual([
      {
        id: 'att-1',
        outcome: 'METHOD_OBTAINED',
        reasonLabel: 'Méthode obtenue',
        method: 'PLATFORM',
        comment: null,
        email: 'a@b.sn',
        fonctionnaire: true,
        engagementEnCours: null,
        dureeEtablissementMois: 24,
        rendezVousAt: null,
        performedById: bob.id,
        performedByName: 'Bob Sarr',
        deviceCallType: 'sortant',
        deviceCallDurationSeconds: 92,
        deviceCallAt: '2026-08-05T10:00:14.000Z',
        clientCreatedAt: DATE.toISOString(),
        dureeTraitementSecondes: 200,
      },
    ]);
  });

  it('ne relit pas les appels d’une fiche absente', async () => {
    prisma.prospect.findFirst.mockResolvedValue(null);

    await expect(service(prisma).callHistory(superviseur, 'p-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.callAttempt.findMany).not.toHaveBeenCalled();
  });

  it('n’écrit rien : modification, suppression et réaffectation lui sont refusées', async () => {
    prisma.prospect.findFirst.mockResolvedValue(prospectRow({ createdById: bob.id }));

    await expect(service(prisma).update(superviseur, 'p-1', { nom: 'Pirate' })).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service(prisma).remove(superviseur, 'p-1')).rejects.toThrow(ForbiddenException);
    await expect(
      service(prisma).reassign(superviseur, { prospectIds: ['p-1'], commercialId: 'com-alice' }),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('le panneau sait saisir une fiche Grand Public', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('un prospect naît sans banque, sans syndicat et sans représentant', async () => {
    prisma.prospect.findFirst.mockResolvedValue(null);
    prisma.prospect.create.mockResolvedValue(prospectRow({}));

    await service(prisma).create(alice, {
      nom: 'Diop',
      prenom: 'Awa',
      phone: '771234567',
      projet: 'GRAND_PUBLIC',
      type: 'INFORMEL',
      profession: 'Couturière',
      dureeSystemeMois: 24,
      canalProvenanceId: 'canal-tiktok',
    });

    const data = firstArg(prisma.prospect.create).data ?? {};
    expect(data.banqueId).toBeNull();
    expect(data.syndicatId).toBeNull();
    expect(data.representantId).toBeNull();
    expect(data.projet).toBe('GRAND_PUBLIC');
    expect(data.type).toBe('INFORMEL');
    expect(data.profession).toBe('Couturière');
    expect(data.dureeSystemeMois).toBe(24);
    expect(data.canalProvenanceId).toBe('canal-tiktok');
  });

  it('sans représentant, l’annuaire n’est pas interrogé du tout', async () => {
    prisma.prospect.findFirst.mockResolvedValue(null);
    prisma.prospect.create.mockResolvedValue(prospectRow({}));

    await service(prisma).create(alice, { nom: 'Diop', prenom: 'Awa', phone: '771234567' });

    // Une lecture du representant sur un identifiant vide ferait echouer la
    // saisie la ou le metier veut qu'elle passe.
    expect(prisma.representant.findFirst).not.toHaveBeenCalled();
  });

  it('une fiche CHUES garde son projet par défaut, sans le demander', async () => {
    prisma.prospect.findFirst.mockResolvedValue(null);
    prisma.representant.findFirst.mockResolvedValue({
      id: 'r-1',
      createdById: alice.id,
    });
    prisma.prospect.create.mockResolvedValue(prospectRow({}));

    await service(prisma).create(alice, {
      nom: 'Fall',
      prenom: 'Moussa',
      phone: '771234567',
      banqueId: 'b-1',
      syndicatId: 's-1',
      representantId: 'r-1',
    });

    expect(firstArg(prisma.prospect.create).data?.projet).toBeUndefined();
  });

  it('trace le consentement sur le parcours Grand Public', async () => {
    prisma.prospect.findFirst.mockResolvedValue(prospectRow({ createdById: alice.id }));

    await service(prisma).setGrandPublicConsent(alice, 'p-1', GrandPublicConsent.INTERESSE);

    expect(firstArg(prisma.prospectJourney.upsert).update).toMatchObject({
      consent: 'INTERESSE',
      consentById: alice.id,
    });
  });

  it('refuse une conversion avant le consentement', async () => {
    prisma.prospect.findFirst.mockResolvedValue(prospectRow({ createdById: alice.id }));

    await expect(
      service(prisma).confirmGrandPublicConversion(alice, 'p-1', { offerId: 'offer-1' }),
    ).rejects.toMatchObject({ response: { code: 'GRAND_PUBLIC_CONSENT_REQUIRED' } });
  });
});
