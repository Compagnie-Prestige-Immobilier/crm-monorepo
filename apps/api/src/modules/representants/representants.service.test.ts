import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  RequestMethod,
} from '@nestjs/common';
import { ChangeSource, RepresentantRelation, Role, WhatsappStatus } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { SortOrder } from '../../common/dto/prospect-filter.dto.js';
import { RepresentantSortField } from './dto.js';
import { RepresentantsController } from './representants.controller.js';
import { RepresentantsService } from './representants.service.js';

type MockFn = ReturnType<typeof vi.fn>;

interface MockDb {
  representant: Record<
    'findFirst' | 'findMany' | 'findUnique' | 'count' | 'create' | 'update' | 'updateMany',
    MockFn
  >;
  representantRelationChange: Record<'create' | 'findMany', MockFn>;
  representantComment: Record<
    'findMany' | 'findUniqueOrThrow' | 'count' | 'createMany' | 'updateMany',
    MockFn
  >;
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
  whatsappStatus: WhatsappStatus.NON_DEMANDE,
  whatsappE164: null,
  profession: null,
  prenom: null,
  etablissement: null,
  syndicat: null,
  connaitUES: null,
  contacte: null,
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
    representantComment: {
      findMany: vi.fn().mockResolvedValue([]),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn((run: (tx: MockDb) => Promise<unknown>) => run(db)),
  };
  service = new RepresentantsService(db as unknown as PrismaService);
});

describe('lookup par téléphone', () => {
  it('rend la fiche d’un autre commercial en entier, en nommant son propriétaire', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());

    const result = await service.lookup('77 123 45 67');

    expect(result.found).toBe(true);
    expect(result.phoneE164).toBe('+221771234567');
    expect(result.ownedByCommercialName).toBe('Moussa Sarr');
    expect(result.ownedByCommercialId).toBe('com-2');
    expect(result.representant?.fullName).toBe('Fatou Ndiaye');
  });

  it('rend exactement les cinq champs du contrat, sans en inventer un', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());

    const result = await service.lookup('77 123 45 67');

    expect(Object.keys(result).sort()).toEqual(
      ['found', 'phoneE164', 'representant', 'ownedByCommercialId', 'ownedByCommercialName'].sort(),
    );
  });

  it('rend la fiche complète quand elle appartient à l’appelant', async () => {
    db.representant.findFirst.mockResolvedValue({
      ...foreignRow(),
      createdById: COMMERCIAL.id,
      createdBy: { id: COMMERCIAL.id, fullName: COMMERCIAL.fullName },
    });

    const result = await service.lookup('77 123 45 67');

    expect(result.representant?.fullName).toBe('Fatou Ndiaye');
    expect(result.ownedByCommercialId).toBe(COMMERCIAL.id);
  });

  it('répond « libre » sans erreur quand le numéro n’est pas pris', async () => {
    const result = await service.lookup('77 123 45 67');

    expect(result.found).toBe(false);
    expect(result.representant).toBeNull();
    expect(result.ownedByCommercialName).toBeNull();
  });

  it('cherche sur tout l’annuaire, sans borner sur un créateur', async () => {
    await service.lookup('77 123 45 67');

    const where = (
      db.representant.findFirst.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0].where;
    expect(where).toMatchObject({});
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

describe('filtre par état de relation', () => {
  const whereOf = (): Record<string, unknown> =>
    (db.representant.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;

  it('ne retient que les fiches dans l’état demandé', async () => {
    await service.list(ADMIN, { relationStatus: [RepresentantRelation.AMBASSADEUR] });

    expect(whereOf().relationStatus).toBe(RepresentantRelation.AMBASSADEUR);
  });

  it('retient tous les états demandés quand il y en a plusieurs', async () => {
    await service.list(ADMIN, {
      relationStatus: [
        RepresentantRelation.CONTACTE,
        RepresentantRelation.AMBASSADEUR,
        RepresentantRelation.REFUS,
      ],
    });

    expect(whereOf().relationStatus).toEqual({
      in: [
        RepresentantRelation.CONTACTE,
        RepresentantRelation.AMBASSADEUR,
        RepresentantRelation.REFUS,
      ],
    });
  });

  it('ne filtre sur rien quand la liste est vide', async () => {
    await service.list(ADMIN, { relationStatus: [] });

    expect(whereOf()).not.toHaveProperty('relationStatus');
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

  it('n’ajoute aucun cloisonnement pour l’encadrement', async () => {
    await service.list(ADMIN, { relationStatus: [RepresentantRelation.AMBASSADEUR] });

    expect(whereOf()).toMatchObject({ relationStatus: RepresentantRelation.AMBASSADEUR });
    expect(whereOf()).not.toHaveProperty('AND');
  });
});

describe('périmètre par campagne', () => {
  const whereOf = (): Record<string, unknown> =>
    (db.representant.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;

  it('un COMMERCIAL ne voit que ses fiches et celles qu’un lot lui confie', async () => {
    await service.list(COMMERCIAL, {});

    expect(whereOf().AND).toEqual([
      {
        OR: [{ createdById: COMMERCIAL.id }, { lotItems: { some: { assigneeId: COMMERCIAL.id } } }],
      },
    ]);
  });

  it('la recherche libre n’écrase pas le périmètre : les deux cohabitent', async () => {
    await service.list(COMMERCIAL, { search: 'Fatou' });

    expect(whereOf().AND).toBeDefined();
    expect(whereOf().OR).toEqual([{ fullName: { contains: 'Fatou', mode: 'insensitive' } }]);
  });

  it('le SUPERVISEUR n’est borné par rien', async () => {
    await service.list(
      { ...COMMERCIAL, id: 'sup-1', role: Role.SUPERVISEUR },
      { relationStatus: [RepresentantRelation.AMBASSADEUR] },
    );

    expect(whereOf()).not.toHaveProperty('AND');
  });

  it('`mesFiches` borne le SUPERVISEUR à ce qu’il doit appeler', async () => {
    const superviseur = { ...COMMERCIAL, id: 'sup-1', role: Role.SUPERVISEUR };
    await service.list(superviseur, { mesFiches: true });

    expect(whereOf().AND).toEqual([
      { OR: [{ createdById: 'sup-1' }, { lotItems: { some: { assigneeId: 'sup-1' } } }] },
    ]);
  });

  it('`mesFiches` borne aussi l’ADMIN, sans quoi le drapeau ne voudrait rien dire', async () => {
    await service.list(ADMIN, { mesFiches: true });

    expect(whereOf().AND).toEqual([
      { OR: [{ createdById: ADMIN.id }, { lotItems: { some: { assigneeId: ADMIN.id } } }] },
    ]);
  });

  it('`mesFiches` ne change rien pour un COMMERCIAL, déjà borné', async () => {
    await service.list(COMMERCIAL, { mesFiches: true });

    expect(whereOf().AND).toEqual([
      {
        OR: [{ createdById: COMMERCIAL.id }, { lotItems: { some: { assigneeId: COMMERCIAL.id } } }],
      },
    ]);
  });

  it('un détail hors périmètre est INTROUVABLE, pas refusé', async () => {
    db.representant.findFirst.mockResolvedValue(null);

    await expect(service.get(COMMERCIAL, 'rep-9')).rejects.toBeInstanceOf(NotFoundException);
    expect(
      (db.representant.findFirst.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where,
    ).toMatchObject({
      OR: [{ createdById: COMMERCIAL.id }, { lotItems: { some: { assigneeId: COMMERCIAL.id } } }],
    });
  });

  it('le dédoublonnage par téléphone reste GLOBAL : sinon on ressaisit un doublon', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());

    await expect(service.lookup('77 123 45 67')).resolves.toMatchObject({ found: true });
    expect(
      (db.representant.findFirst.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where,
    ).not.toHaveProperty('OR');
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
    (db.representantRelationChange.create.mock.calls[0] as [{ data: Record<string, unknown> }])[0]
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
    db.representant.findFirst.mockResolvedValue(own({}));

    await new RepresentantsService(db as unknown as PrismaService).update(COMMERCIAL, 'rep-9', {
      relationStatus: RepresentantRelation.CONTACTE,
    });

    expect(historyOf()).toMatchObject({
      representantId: 'rep-9',
      toStatus: RepresentantRelation.CONTACTE,
    });
    expect(historyOf()).not.toHaveProperty('isDemo');
  });

  it('porte le motif jusqu’à l’histoire', async () => {
    db.representant.findFirst.mockResolvedValue(own());

    await service.update(COMMERCIAL, 'rep-9', {
      relationStatus: RepresentantRelation.REFUS,
      relationReason: 'Ne veut plus etre appele avant la rentree',
    });

    expect(historyOf().reason).toBe('Ne veut plus etre appele avant la rentree');
  });

  it('accepte un payload sans motif, et l’histoire porte alors null', async () => {
    db.representant.findFirst.mockResolvedValue(own());

    await service.update(COMMERCIAL, 'rep-9', {
      relationStatus: RepresentantRelation.AMBASSADEUR,
    });

    expect(historyOf().reason).toBeNull();
  });

  it('ne retient pas un motif fait d’espaces', async () => {
    db.representant.findFirst.mockResolvedValue(own());

    await service.update(COMMERCIAL, 'rep-9', {
      relationStatus: RepresentantRelation.AMBASSADEUR,
      relationReason: '   ',
    });

    expect(historyOf().reason).toBeNull();
  });

  it('persiste les champs du script de qualification quand ils sont fournis', async () => {
    db.representant.findFirst.mockResolvedValue(own());

    await service.update(COMMERCIAL, 'rep-9', {
      prenom: 'Awa',
      etablissement: 'Lycée Blaise Diagne',
      syndicat: 'SUDES',
      connaitUES: true,
      contacte: false,
    });

    const data = (db.representant.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0]
      .data;
    expect(data).toMatchObject({
      prenom: 'Awa',
      etablissement: 'Lycée Blaise Diagne',
      syndicat: 'SUDES',
      connaitUES: true,
      contacte: false,
    });
  });

  it('vide un texte de qualification quand la chaîne est vide, sans toucher les booléens absents', async () => {
    db.representant.findFirst.mockResolvedValue(own());

    await service.update(COMMERCIAL, 'rep-9', { syndicat: '   ' });

    const data = (db.representant.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0]
      .data;
    expect(data.syndicat).toBeNull();
    expect(data).not.toHaveProperty('connaitUES');
    expect(data).not.toHaveProperty('contacte');
  });
});

describe('historique de relation', () => {
  it('ouvre l’histoire d’une fiche d’un autre téléconseiller : l’annuaire est commun', async () => {
    db.representant.findFirst.mockResolvedValue({ id: 'rep-9', createdById: 'com-2' });

    await expect(service.relationHistory('rep-9')).resolves.toEqual({ items: [] });
  });

  it('rend 404 sur une fiche absente ou supprimée', async () => {
    db.representant.findFirst.mockResolvedValue(null);

    await expect(service.relationHistory('rep-9')).rejects.toBeInstanceOf(NotFoundException);
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

    const result = await service.relationHistory('rep-9');

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

    await expect(service.relationHistory('rep-9')).resolves.toEqual({ items: [] });
  });
});

describe('fil de commentaires', () => {
  const own = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    ...foreignRow(),
    createdById: COMMERCIAL.id,
    createdBy: { id: COMMERCIAL.id, fullName: COMMERCIAL.fullName },
    ...over,
  });

  const comment = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'cmt-1',
    representantId: 'rep-9',
    authorId: COMMERCIAL.id,
    author: { fullName: COMMERCIAL.fullName },
    body: 'Rappeler apres la rentree',
    clientCreatedAt: date,
    createdAt: date,
    ...over,
  });

  const postedData = (call: number): Record<string, unknown> =>
    (db.representantComment.createMany.mock.calls[call] as [{ data: Record<string, unknown>[] }])[0]
      .data[0] as Record<string, unknown>;

  it('deux commentaires du même geste COEXISTENT, sans rien à arbitrer', async () => {
    db.representant.findFirst.mockResolvedValue(own());
    db.representantComment.findUniqueOrThrow
      .mockResolvedValueOnce(comment({ id: 'cmt-a', authorId: COMMERCIAL.id }))
      .mockResolvedValueOnce(
        comment({ id: 'cmt-b', authorId: ADMIN.id, author: { fullName: ADMIN.fullName } }),
      );

    const premier = await service.addComment(COMMERCIAL, 'rep-9', {
      id: 'cmt-a',
      body: 'Vu sur place',
    });
    const second = await service.addComment(ADMIN, 'rep-9', {
      id: 'cmt-b',
      body: 'Relance faite',
    });

    expect([premier.id, second.id]).toEqual(['cmt-a', 'cmt-b']);
    expect(db.representantComment.createMany).toHaveBeenCalledTimes(2);
    expect(postedData(0)).toMatchObject({ id: 'cmt-a', authorId: COMMERCIAL.id });
    expect(postedData(1)).toMatchObject({ id: 'cmt-b', authorId: ADMIN.id });

    // Aucune bascule de révision : sans `rev`, il n'y a pas de fusion possible.
    expect(db.representant.updateMany).not.toHaveBeenCalled();
    expect(db.representant.update).not.toHaveBeenCalled();
    for (const [call] of db.representantComment.createMany.mock.calls as [
      Record<string, unknown>,
    ][]) {
      expect(call).not.toHaveProperty('rev');
    }
  });

  it('un rejeu du même identifiant ne crée pas de doublon', async () => {
    db.representant.findFirst.mockResolvedValue(own());
    db.representantComment.createMany.mockResolvedValue({ count: 0 });
    db.representantComment.findUniqueOrThrow.mockResolvedValue(comment());

    const rejoue = await service.addComment(COMMERCIAL, 'rep-9', {
      id: 'cmt-1',
      body: 'Rappeler apres la rentree',
    });

    expect(rejoue.id).toBe('cmt-1');
    expect(
      (db.representantComment.createMany.mock.calls[0] as [{ skipDuplicates: boolean }])[0]
        .skipDuplicates,
    ).toBe(true);
  });

  it('l’auteur vient de la session, jamais du corps de requête', async () => {
    db.representant.findFirst.mockResolvedValue(own());
    db.representantComment.findUniqueOrThrow.mockResolvedValue(comment());

    const corpsAvecAuteur = { id: 'cmt-1', body: 'Vu sur place', authorId: 'com-2' };
    await service.addComment(COMMERCIAL, 'rep-9', corpsAvecAuteur);

    expect(postedData(0).authorId).toBe(COMMERCIAL.id);
  });

  it('refuse un identifiant déjà pris par le commentaire d’un autre', async () => {
    db.representant.findFirst.mockResolvedValue(own());
    db.representantComment.createMany.mockResolvedValue({ count: 0 });
    db.representantComment.findUniqueOrThrow.mockResolvedValue(comment({ authorId: 'com-2' }));

    await expect(
      service.addComment(COMMERCIAL, 'rep-9', { id: 'cmt-1', body: 'Vu sur place' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('commente la fiche d’un autre téléconseiller : l’annuaire est commun', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());
    db.representantComment.findUniqueOrThrow.mockResolvedValue(comment());

    await expect(
      service.addComment(COMMERCIAL, 'rep-9', { id: 'cmt-1', body: 'Vu sur place' }),
    ).resolves.toMatchObject({ id: 'cmt-1' });
    expect(postedData(0).authorId).toBe(COMMERCIAL.id);
  });

  it('le commentaire suit la nature de la FICHE, pas le mode en vigueur', async () => {
    db.representant.findFirst.mockResolvedValue(own({}));
    db.representantComment.findUniqueOrThrow.mockResolvedValue(comment());

    await new RepresentantsService(db as unknown as PrismaService).addComment(COMMERCIAL, 'rep-9', {
      id: 'cmt-1',
      body: 'Vu sur place',
    });

    expect(postedData(0)).toMatchObject({ representantId: 'rep-9', body: 'Vu sur place' });
    expect(postedData(0)).not.toHaveProperty('isDemo');
  });

  it('rend le fil du plus récent au plus ancien, départagé par l’identifiant', async () => {
    db.representant.findFirst.mockResolvedValue({ id: 'rep-9', createdById: COMMERCIAL.id });
    db.representantComment.count.mockResolvedValue(1);
    db.representantComment.findMany.mockResolvedValue([comment()]);

    const result = await service.listComments('rep-9', {});

    expect(result.items).toEqual([
      {
        id: 'cmt-1',
        representantId: 'rep-9',
        authorId: COMMERCIAL.id,
        authorName: COMMERCIAL.fullName,
        body: 'Rappeler apres la rentree',
        clientCreatedAt: date.toISOString(),
        createdAt: date.toISOString(),
      },
    ]);

    const args = db.representantComment.findMany.mock.calls[0]?.[0] as { orderBy: unknown[] };
    expect(args.orderBy).toEqual([{ clientCreatedAt: 'desc' }, { id: 'desc' }]);
  });

  it('ouvre le fil de la fiche d’un autre téléconseiller : l’annuaire est commun', async () => {
    db.representant.findFirst.mockResolvedValue({ id: 'rep-9', createdById: 'com-2' });

    await expect(service.listComments('rep-9', {})).resolves.toMatchObject({ items: [] });
  });

  it('rend 404 sur le fil d’une fiche absente ou supprimée', async () => {
    db.representant.findFirst.mockResolvedValue(null);

    await expect(service.listComments('rep-9', {})).rejects.toBeInstanceOf(NotFoundException);
    expect(db.representantComment.findMany).not.toHaveBeenCalled();
  });

  it('la suppression est DOUCE et bornée à la fiche visée', async () => {
    await expect(service.removeComment('rep-9', 'cmt-1')).resolves.toEqual({ ok: true });

    const args = db.representantComment.updateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(args.where).toMatchObject({ id: 'cmt-1', representantId: 'rep-9', deletedAt: null });
    expect(args.data.deletedAt).toBeInstanceOf(Date);
  });

  it('AUCUNE route n’édite un commentaire', () => {
    const prototype = RepresentantsController.prototype as unknown as Record<string, object>;
    const verbes = Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => ({
        path: Reflect.getMetadata('path', prototype[name] as object) as string | undefined,
        verbe: Reflect.getMetadata('method', prototype[name] as object) as number | undefined,
      }))
      .filter((route) => (route.path ?? '').includes('comments'))
      .map((route) => route.verbe)
      .sort((a, b) => (a ?? 0) - (b ?? 0));

    expect(verbes).toEqual(
      [RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE].sort((a, b) => a - b),
    );
    expect(service).not.toHaveProperty('updateComment');
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
    (db.representant.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;

  it('liste l’annuaire national', async () => {
    await service.list(SUPERVISEUR, {});

    expect(whereOf().createdById).toBeUndefined();
    expect(whereOf()).not.toHaveProperty('AND');
  });

  it('son filtre par téléconseiller RÉPOND, au lieu de rendre zéro ligne', async () => {
    await service.list(SUPERVISEUR, { commercialId: 'com-2' });

    expect(whereOf().createdById).toBe('com-2');
  });

  it('ouvre la fiche d’autrui, et son historique de relation', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());

    await expect(service.get(SUPERVISEUR, 'rep-9')).resolves.toMatchObject({ id: 'rep-9' });
    await expect(service.relationHistory('rep-9')).resolves.toMatchObject({ items: [] });
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

  it('lit le fil de commentaires, et en dépose comme un téléconseiller', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());
    db.representantComment.findUniqueOrThrow.mockResolvedValue({
      id: 'cmt-1',
      representantId: 'rep-9',
      authorId: SUPERVISEUR.id,
      author: { fullName: SUPERVISEUR.fullName },
      body: 'vu',
      clientCreatedAt: date,
      createdAt: date,
    });

    await expect(service.listComments('rep-9', {})).resolves.toMatchObject({ items: [] });
    await expect(
      service.addComment(SUPERVISEUR, 'rep-9', { id: 'cmt-1', body: 'vu' }),
    ).resolves.toMatchObject({ id: 'cmt-1' });
  });
});

describe('WhatsApp et profession sur la fiche', () => {
  const own = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    ...foreignRow(),
    createdById: COMMERCIAL.id,
    createdBy: { id: COMMERCIAL.id, fullName: COMMERCIAL.fullName },
    ...over,
  });

  const whereOf = (): Record<string, unknown> =>
    (db.representant.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;

  const patchOf = (): Record<string, unknown> =>
    (db.representant.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;

  it('recompose le numéro joignable pour les trois cas de lecture', async () => {
    db.representant.findFirst.mockResolvedValue(
      own({ whatsappStatus: WhatsappStatus.MEME_NUMERO }),
    );
    await expect(service.get(COMMERCIAL, 'rep-9')).resolves.toMatchObject({
      whatsappNumber: '+221771234567',
      whatsappE164: null,
    });

    db.representant.findFirst.mockResolvedValue(
      own({ whatsappStatus: WhatsappStatus.AUTRE_NUMERO, whatsappE164: '+221780000001' }),
    );
    await expect(service.get(COMMERCIAL, 'rep-9')).resolves.toMatchObject({
      whatsappNumber: '+221780000001',
    });

    db.representant.findFirst.mockResolvedValue(own({ whatsappStatus: WhatsappStatus.AUCUN }));
    await expect(service.get(COMMERCIAL, 'rep-9')).resolves.toMatchObject({
      whatsappNumber: null,
      whatsappStatus: WhatsappStatus.AUCUN,
    });
  });

  it('la correction à froid pose le statut, le numéro et la profession', async () => {
    db.representant.findFirst.mockResolvedValue(own());

    await service.update(COMMERCIAL, 'rep-9', {
      whatsappStatus: WhatsappStatus.AUTRE_NUMERO,
      whatsappE164: '78 000 00 01',
      profession: 'Enseignant',
    });

    expect(patchOf()).toMatchObject({
      whatsappStatus: WhatsappStatus.AUTRE_NUMERO,
      whatsappE164: '+221780000001',
      profession: 'Enseignant',
    });
  });

  it('MEME_NUMERO n’écrit AUCUN numéro dédié', async () => {
    db.representant.findFirst.mockResolvedValue(own());

    await service.update(COMMERCIAL, 'rep-9', { whatsappStatus: WhatsappStatus.MEME_NUMERO });

    expect(patchOf()).toMatchObject({ whatsappStatus: WhatsappStatus.MEME_NUMERO });
    expect(patchOf()).not.toHaveProperty('whatsappE164');
  });

  it('refuse un numéro porté par un statut qui l’interdit, sans rien écrire', async () => {
    db.representant.findFirst.mockResolvedValue(own());

    await expect(
      service.update(COMMERCIAL, 'rep-9', {
        whatsappStatus: WhatsappStatus.MEME_NUMERO,
        whatsappE164: '78 000 00 01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.representant.update).not.toHaveBeenCalled();
  });

  it('une modification qui ne parle pas de WhatsApp ne touche à rien', async () => {
    db.representant.findFirst.mockResolvedValue(
      own({ whatsappStatus: WhatsappStatus.AUTRE_NUMERO, whatsappE164: '+221780000001' }),
    );

    await service.update(COMMERCIAL, 'rep-9', { notes: 'Rappeler lundi' });

    expect(patchOf()).not.toHaveProperty('whatsappStatus');
    expect(patchOf()).not.toHaveProperty('whatsappE164');
    expect(patchOf()).not.toHaveProperty('profession');
  });

  it('filtre sur un état WhatsApp précis', async () => {
    await service.list(ADMIN, { whatsappStatus: WhatsappStatus.NON_DEMANDE });

    expect(whereOf().whatsappStatus).toEqual({ in: [WhatsappStatus.NON_DEMANDE] });
  });

  it('hasWhatsapp sépare les joignables de tous les autres, question non posée comprise', async () => {
    await service.list(ADMIN, { hasWhatsapp: true });
    expect(whereOf().whatsappStatus).toEqual({
      in: [WhatsappStatus.MEME_NUMERO, WhatsappStatus.AUTRE_NUMERO],
    });

    db.representant.findMany.mockClear();
    await service.list(ADMIN, { hasWhatsapp: false });
    expect(whereOf().whatsappStatus).toEqual({
      in: [WhatsappStatus.NON_DEMANDE, WhatsappStatus.AUCUN],
    });
  });

  it('les deux filtres se composent par intersection, aucun n’en écrase un autre', async () => {
    await service.list(ADMIN, { hasWhatsapp: false, whatsappStatus: WhatsappStatus.AUCUN });

    expect(whereOf().whatsappStatus).toEqual({ in: [WhatsappStatus.AUCUN] });
  });

  it('ne filtre sur rien quand aucun des deux n’est demandé', async () => {
    await service.list(ADMIN, {});

    expect(whereOf()).not.toHaveProperty('whatsappStatus');
  });
});

describe('tri par priorité de traitement', () => {
  const orderByOf = (): unknown =>
    (db.representant.findMany.mock.calls[0] as [{ orderBy: unknown }])[0].orderBy;

  it('remonte les priorités hautes, et les fiches jamais qualifiées en dernier', async () => {
    await service.list(ADMIN, { sortBy: RepresentantSortField.PRIORITE });

    // `asc` sur l'énumération suit son ordre de déclaration, HAUTE d'abord, et
    // PostgreSQL classe les NULL en dernier dans ce sens : une fiche sans
    // statut ne double pas celles qu'on a qualifiées.
    expect(orderByOf()).toEqual([{ statutQualification: { priorite: 'asc' } }, { id: 'desc' }]);
  });

  it('accepte l’ordre inverse quand il est demandé', async () => {
    await service.list(ADMIN, {
      sortBy: RepresentantSortField.PRIORITE,
      sortOrder: SortOrder.DESC,
    });

    expect(orderByOf()).toEqual([{ statutQualification: { priorite: 'desc' } }, { id: 'desc' }]);
  });
});
