import { ConflictException } from '@nestjs/common';
import { Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { RepresentantsController } from './representants.controller.js';
import { RepresentantsService } from './representants.service.js';

/**
 * Ce que le lookup par téléphone a le droit de DIRE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT CORRIGÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `lookup` répondait avec le DTO complet de la fiche d'autrui : nom du
 * représentant, téléphone normalisé, notes de terrain, département, nombre de
 * prospects portés, identifiant du propriétaire. Sa propre documentation
 * annonçait pourtant « seul le nom du propriétaire est divulgué ». La route
 * n'ayant par ailleurs aucun `@Roles`, n'importe quel compte authentifié,
 * BANQUE_FINANCE compris, pouvait énumérer l'annuaire numéro par numéro.
 */

type MockFn = ReturnType<typeof vi.fn>;

interface MockDb {
  representant: Record<'findFirst' | 'findMany' | 'findUnique' | 'count' | 'create', MockFn>;
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

/** Fiche appartenant à `com-2`, donc à quelqu'un d'autre que `COMMERCIAL`. */
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
    },
  };
  service = new RepresentantsService(db as unknown as PrismaService, fakeDemoVisibility());
});

describe('lookup par téléphone', () => {
  it('ne divulgue QUE le nom du propriétaire sur la fiche d’un autre commercial', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());

    const result = await service.lookup(COMMERCIAL, '77 123 45 67');

    // Ce que l'appelant doit apprendre : le numéro est pris, et par qui.
    expect(result.found).toBe(true);
    expect(result.phoneE164).toBe('+221771234567');
    expect(result.ownedByCommercialName).toBe('Moussa Sarr');

    // Ce qu'il ne doit PAS apprendre.
    expect(result.representant).toBeNull();
    expect(result.ownedByCommercialId).toBeNull();
  });

  /**
   * La forme MINIMALE, en extension et non en compréhension.
   *
   * Le test ci-dessus nomme ce qui doit être nul. Il ne dit rien d'un champ
   * AJOUTÉ demain au DTO : `lastProspectAt`, `departementName`, un compteur.
   * Un champ neuf naît renseigné dans la branche « fiche d'autrui » aussi
   * sûrement que dans l'autre, et aucune assertion existante ne bouge. On fige
   * donc l'ensemble EXACT des clés, puis on relit la réponse sérialisée à la
   * recherche de tout ce que la fiche contenait.
   */
  it('n’expose RIEN d’autre que found, phoneE164 et le nom du propriétaire', async () => {
    db.representant.findFirst.mockResolvedValue(foreignRow());

    const result = await service.lookup(COMMERCIAL, '77 123 45 67');

    expect(Object.keys(result).sort()).toEqual(
      ['found', 'phoneE164', 'representant', 'ownedByCommercialId', 'ownedByCommercialName'].sort(),
    );

    // Tout ce que porte la ligne d'autrui et qui ne doit pas franchir la
    // frontière : identité du représentant, notes de terrain, rattachement,
    // volume de portefeuille, identifiant du propriétaire.
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

    // Garde-fou : une réponse vide satisferait toutes les lignes ci-dessus.
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
    // `found: false` et non 404 : « ce numéro est libre » est la réponse
    // ORDINAIRE sur le chemin de saisie, pas une exception à traiter.
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

  /**
   * L'index unique partiel `representants_phone_e164_active_key` est GLOBAL :
   * il ne connaît pas le mode démonstration. Filtrer ce contrôle déclarerait
   * libre un numéro que la base refuse ensuite, et le commercial recevrait un
   * 409 générique au lieu de ce message-ci.
   */
  it('cherche le conflit SANS portée de démonstration : l’unicité est globale', async () => {
    await service.create(COMMERCIAL, input).catch(() => undefined);

    const calls = db.representant.findFirst.mock.calls as [{ where: Record<string, unknown> }][];
    const conflictCall = calls.find((call) => 'phoneE164' in call[0].where);
    expect(conflictCall?.[0].where).toEqual({ phoneE164: '+221771234567', deletedAt: null });
  });
});

describe('cloisonnement de la route', () => {
  /**
   * Le rôle est posé SUR LA CLASSE : une route ajoutée demain hérite de la
   * restriction au lieu de naître ouverte. Sans décorateur, `RolesGuard`
   * laisse passer toute identité authentifiée, y compris BANQUE_FINANCE, qui
   * n'a aucun usage de l'annuaire de prospection.
   */
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

    // `getAllAndOverride` fait gagner le décorateur de méthode sur celui de la
    // classe : l'import reste plus fermé que le reste du contrôleur.
    expect(roles).toEqual([Role.ADMIN]);
  });
});

/**
 * La nature de la fiche, à la création.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT CORRIGÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `create` n'écrivait pas `isDemo`. La colonne prenait son défaut, FALSE, et
 * un représentant saisi pendant une démonstration devenait une VRAIE fiche de
 * l'annuaire : encore listée après l'extinction du mode, comptée dans la
 * productivité, et que rien ne désigne comme fictive.
 *
 * Un représentant est une RACINE : il n'a pas de ligne de rattachement dont
 * hériter, l'interrupteur décide donc seul.
 */
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
