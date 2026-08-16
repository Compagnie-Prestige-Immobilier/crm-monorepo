import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role } from '@crm/database';
import type { BddSegment } from '@crm/database';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { SegmentChangeService } from './segment-change.service.js';
import { ProspectSegmentError } from './errors.js';
import {
  ALICE,
  BANQUE_BHS,
  BANQUE_CBAO,
  BOB,
  FakeSegmentPrisma,
  SYNDICAT_CHUES,
  SYNDICAT_SAES,
} from './fake-segment-prisma.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CE FICHIER ÉPROUVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Quatre énoncés, et aucun n'est vérifiable en lisant le service :
 *
 *   1. les deux segments sont ceux de la DÉFINITION PARTAGÉE, des deux côtés
 *      de la bascule et pour les quatre cases de la matrice ;
 *   2. la fiche et sa trace partent ENSEMBLE, ou ne partent pas ;
 *   3. un geste qui ne change aucune clé est REFUSÉ, plutôt que d'écrire une
 *      ligne d'histoire vide ;
 *   4. une révision périmée n'écrit rien et le dit.
 *
 * Les quatre passent par une doublure qui INTERPRÈTE le `where` : voir
 * l'en-tête de `fake-segment-prisma.ts` pour la raison, qui est la même que
 * dans Banque & Financement.
 */

const alice: AuthenticatedUser = {
  id: ALICE.id,
  email: 'alice@cpi.sn',
  username: 'alice',
  fullName: ALICE.fullName,
  role: Role.COMMERCIAL,
};
const admin: AuthenticatedUser = { ...alice, id: 'admin-1', username: 'admin', role: Role.ADMIN };

const service = (prisma: FakeSegmentPrisma): SegmentChangeService =>
  new SegmentChangeService(prisma.asService());

const codeOf = (error: unknown): unknown =>
  (((error as { response?: unknown }).response ?? {}) as { code?: unknown }).code;

/** Le CORPS du refus, celui que le client lit réellement. */
async function bodyOf(promise: Promise<unknown>): Promise<Record<string, unknown>> {
  try {
    await promise;
  } catch (error) {
    return ((error as { response?: unknown }).response ?? {}) as Record<string, unknown>;
  }
  throw new Error('aucune exception levée alors qu’un refus était attendu');
}

/** Les quatre cases de la matrice, chacune par son couple de clés. */
const COMBOS = [
  { segment: 'BDD1', banqueId: BANQUE_CBAO.id, syndicatId: SYNDICAT_CHUES.id },
  { segment: 'BDD2', banqueId: BANQUE_BHS.id, syndicatId: SYNDICAT_CHUES.id },
  { segment: 'BDD3', banqueId: BANQUE_CBAO.id, syndicatId: SYNDICAT_SAES.id },
  { segment: 'BDD4', banqueId: BANQUE_BHS.id, syndicatId: SYNDICAT_SAES.id },
] as const satisfies readonly { segment: BddSegment; banqueId: string; syndicatId: string }[];

describe('segment calculé des DEUX côtés de la bascule', () => {
  /**
   * Les douze migrations possibles entre les quatre cases.
   *
   * Éprouver une seule bascule, la seule qui intéresse le métier (BDD3 → BDD1),
   * laisserait passer une inversion d'axe : `classifySegment` appelé avec le
   * sigle à la place du nom court rangerait toutes les fiches du même côté, et
   * un test unique tomberait juste une fois sur deux.
   */
  for (const from of COMBOS) {
    for (const to of COMBOS) {
      if (from.segment === to.segment) continue;

      it(`${from.segment} → ${to.segment} : la trace porte les deux segments`, async () => {
        const prisma = new FakeSegmentPrisma();
        prisma.addProspect({ id: 'p-1', banqueId: from.banqueId, syndicatId: from.syndicatId });

        await service(prisma).migrate(admin, 'p-1', {
          banqueId: to.banqueId,
          syndicatId: to.syndicatId,
          reason: 'Le client a domicilié son salaire ailleurs.',
          expectedRev: 1,
        });

        const [trace] = prisma.segmentChanges;
        expect(trace?.fromSegment).toBe(from.segment);
        expect(trace?.toSegment).toBe(to.segment);
        // Les clés d'AVANT sont conservées telles qu'elles étaient : sans
        // elles, la ligne dit d'où la fiche vient en segment mais pas en
        // référentiel, et l'écart ne se rattrape plus.
        expect(trace?.fromBanqueId).toBe(from.banqueId);
        expect(trace?.fromSyndicatId).toBe(from.syndicatId);
        expect(trace?.toBanqueId).toBe(to.banqueId);
        expect(trace?.toSyndicatId).toBe(to.syndicatId);
      });
    }
  }

  it('rend la fiche à jour, segment RECALCULÉ et non relu d’une colonne', async () => {
    const prisma = new FakeSegmentPrisma();
    prisma.addProspect({ id: 'p-1', banqueId: BANQUE_BHS.id, syndicatId: SYNDICAT_SAES.id });

    const saved = await service(prisma).migrate(admin, 'p-1', {
      banqueId: BANQUE_CBAO.id,
      syndicatId: SYNDICAT_CHUES.id,
      reason: 'Adhésion au CHUES et domiciliation CBAO.',
      expectedRev: 1,
    });

    expect(saved.segment).toBe('BDD1');
    expect(saved.banqueId).toBe(BANQUE_CBAO.id);
    expect(saved.syndicatId).toBe(SYNDICAT_CHUES.id);
    expect(saved.rev).toBe(2);
  });
});

describe('la fiche et sa trace partent ENSEMBLE', () => {
  it('une migration réussie écrit les deux, et la trace nomme son auteur et son canal', async () => {
    const prisma = new FakeSegmentPrisma();
    prisma.addProspect({ id: 'p-1', banqueId: BANQUE_CBAO.id, syndicatId: SYNDICAT_SAES.id });

    await service(prisma).migrate(alice, 'p-1', {
      syndicatId: SYNDICAT_CHUES.id,
      reason: '  Bascule décidée en comité du 12 août.  ',
      expectedRev: 1,
    });

    expect(prisma.prospects[0]?.syndicatId).toBe(SYNDICAT_CHUES.id);
    expect(prisma.segmentChanges).toHaveLength(1);
    expect(prisma.segmentChanges[0]).toMatchObject({
      prospectId: 'p-1',
      fromSegment: 'BDD3',
      toSegment: 'BDD1',
      changedById: alice.id,
      source: 'WEB',
      reason: 'Bascule décidée en comité du 12 août.',
    });
  });

  /**
   * LE TEST QUI JUSTIFIE LA TRANSACTION.
   *
   * Sans elle, la fiche resterait basculée et l'histoire, muette : exactement
   * l'état que cette table existe pour rendre impossible. Ce n'est pas une
   * hypothèse d'école, c'est ce que produit toute coupure entre deux écritures
   * indépendantes.
   */
  it('une trace qui ne peut pas s’écrire ANNULE la bascule', async () => {
    const prisma = new FakeSegmentPrisma();
    prisma.addProspect({ id: 'p-1', banqueId: BANQUE_BHS.id, syndicatId: SYNDICAT_SAES.id });
    prisma.onSegmentChangeCreate = () => {
      throw new Error('segment_changes indisponible');
    };

    await expect(
      service(prisma).migrate(admin, 'p-1', {
        banqueId: BANQUE_CBAO.id,
        syndicatId: SYNDICAT_CHUES.id,
        reason: 'Conversion validée par la direction.',
        expectedRev: 1,
      }),
    ).rejects.toThrow(/segment_changes/u);

    expect(prisma.prospects[0]?.banqueId).toBe(BANQUE_BHS.id);
    expect(prisma.prospects[0]?.syndicatId).toBe(SYNDICAT_SAES.id);
    expect(prisma.prospects[0]?.rev).toBe(1);
    expect(prisma.segmentChanges).toEqual([]);
  });

  it('la trace suit la NATURE de la fiche, pas celle du moment', async () => {
    const prisma = new FakeSegmentPrisma();
    prisma.addProspect({ id: 'p-1', isDemo: true, banqueId: BANQUE_BHS.id });

    await service(prisma).migrate(admin, 'p-1', {
      banqueId: BANQUE_CBAO.id,
      reason: 'Fiche de démonstration, bascule montrée à l’écran.',
      expectedRev: 1,
    });

    // Une trace réelle posée sur une fiche fictive entrerait dans le décompte
    // des conversions du mois, et survivrait à l'extinction du mode.
    expect(prisma.segmentChanges[0]?.isDemo).toBe(true);
  });
});

describe('refus', () => {
  it('refuse le geste qui ne change AUCUNE clé, plutôt que d’écrire une ligne vide', async () => {
    const prisma = new FakeSegmentPrisma();
    prisma.addProspect({ id: 'p-1', banqueId: BANQUE_CBAO.id, syndicatId: SYNDICAT_SAES.id });

    const promise = service(prisma).migrate(admin, 'p-1', {
      banqueId: BANQUE_CBAO.id,
      syndicatId: SYNDICAT_SAES.id,
      reason: 'On ne change rien, mais on clique.',
      expectedRev: 1,
    });

    await expect(promise).rejects.toThrow(UnprocessableEntityException);
    await expect(promise.catch((error: unknown) => codeOf(error))).resolves.toBe(
      ProspectSegmentError.UNCHANGED,
    );
    expect(prisma.segmentChanges).toEqual([]);
    expect(prisma.prospects[0]?.rev).toBe(1);
  });

  it('refuse aussi quand aucune des deux clés n’est envoyée', async () => {
    const prisma = new FakeSegmentPrisma();
    prisma.addProspect({ id: 'p-1' });

    await expect(
      service(prisma).migrate(admin, 'p-1', { reason: 'Motif sans destination.', expectedRev: 1 }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.segmentChanges).toEqual([]);
  });

  /**
   * Deux utilisateurs sur la même fiche : le second doit être arrêté par la
   * BASE, pas par une relecture qu'il aurait faite juste avant. La doublure
   * applique réellement `rev` dans le `where`, sans quoi ce test resterait vert
   * la garde retirée.
   */
  it('une révision périmée n’écrit rien et rend la révision RÉELLE', async () => {
    const prisma = new FakeSegmentPrisma();
    prisma.addProspect({ id: 'p-1', rev: 4, banqueId: BANQUE_BHS.id });

    const promise = service(prisma).migrate(admin, 'p-1', {
      banqueId: BANQUE_CBAO.id,
      reason: 'Bascule décidée sur un écran périmé.',
      expectedRev: 3,
    });

    await expect(promise).rejects.toThrow(ConflictException);
    const body = await bodyOf(promise);
    expect(body.code).toBe(ProspectSegmentError.REV_CONFLICT);
    // L'écran a besoin de la révision COURANTE pour proposer un rechargement
    // qui aboutira, au lieu de renvoyer l'utilisateur au même échec.
    expect(body.currentRev).toBe(4);

    expect(prisma.prospects[0]?.banqueId).toBe(BANQUE_BHS.id);
    expect(prisma.segmentChanges).toEqual([]);
  });

  it('une fiche supprimée logiquement n’est plus convertible', async () => {
    const prisma = new FakeSegmentPrisma();
    prisma.addProspect({ id: 'p-1', deletedAt: new Date('2026-08-02T00:00:00.000Z') });

    await expect(
      service(prisma).migrate(admin, 'p-1', {
        banqueId: BANQUE_CBAO.id,
        reason: 'Conversion sur une fiche supprimée.',
        expectedRev: 1,
      }),
    ).rejects.toThrow(/introuvable/u);
  });

  it('un COMMERCIAL ne convertit pas la fiche d’un collègue', async () => {
    const prisma = new FakeSegmentPrisma();
    prisma.addProspect({ id: 'p-1', createdById: BOB.id, banqueId: BANQUE_BHS.id });

    await expect(
      service(prisma).migrate(alice, 'p-1', {
        banqueId: BANQUE_CBAO.id,
        reason: 'Conversion d’une fiche qui ne m’appartient pas.',
        expectedRev: 1,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.segmentChanges).toEqual([]);
  });

  it('refuse une banque de destination inconnue, sans rien écrire', async () => {
    const prisma = new FakeSegmentPrisma();
    prisma.addProspect({ id: 'p-1' });

    const promise = service(prisma).migrate(admin, 'p-1', {
      banqueId: 'bnq-inexistante',
      reason: 'Destination inconnue du référentiel.',
      expectedRev: 1,
    });

    await expect(promise).rejects.toThrow(UnprocessableEntityException);
    await expect(promise.catch((error: unknown) => codeOf(error))).resolves.toBe(
      ProspectSegmentError.BANQUE_NOT_FOUND,
    );
    expect(prisma.segmentChanges).toEqual([]);
  });
});

describe('historique d’une fiche', () => {
  it('rend les bascules de la plus récente à la plus ancienne, avec leur auteur', async () => {
    const prisma = new FakeSegmentPrisma();
    prisma.addProspect({ id: 'p-1', banqueId: BANQUE_BHS.id, syndicatId: SYNDICAT_SAES.id });
    const subject = service(prisma);

    await subject.migrate(alice, 'p-1', {
      syndicatId: SYNDICAT_CHUES.id,
      reason: 'Adhésion au CHUES.',
      expectedRev: 1,
    });
    await subject.migrate(alice, 'p-1', {
      banqueId: BANQUE_CBAO.id,
      reason: 'Domiciliation CBAO obtenue.',
      expectedRev: 2,
    });

    const { items } = await subject.history(alice, 'p-1');

    expect(items.map((item) => [item.fromSegment, item.toSegment])).toEqual([
      ['BDD2', 'BDD1'],
      ['BDD4', 'BDD2'],
    ]);
    expect(items[0]?.changedByName).toBe(ALICE.fullName);
    expect(items[0]?.source).toBe('WEB');
  });

  it('un COMMERCIAL ne lit pas l’historique de la fiche d’un collègue', async () => {
    const prisma = new FakeSegmentPrisma();
    prisma.addProspect({ id: 'p-1', createdById: BOB.id });

    await expect(service(prisma).history(alice, 'p-1')).rejects.toThrow(ForbiddenException);
  });
});
