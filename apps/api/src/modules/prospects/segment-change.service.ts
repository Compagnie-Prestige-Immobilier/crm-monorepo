import { Injectable } from '@nestjs/common';
import { ChangeSource, classifySegment } from '@crm/database';
import type { BddSegment } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { assertOwnership } from '../../common/scope.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { lastAttemptsByProspect } from './last-attempt.js';
import { PROSPECT_INCLUDE, toProspectDto } from './prospects.service.js';
import {
  banqueNotFound,
  prospectNotFound,
  prospectRevConflict,
  segmentUnavailable,
  segmentUnchanged,
  syndicatNotFound,
} from './errors.js';
import type {
  ChangeProspectSegmentDto,
  ProspectDto,
  SegmentChangeDto,
  SegmentChangeListDto,
} from './dto.js';

/** Sentinelle interne : la transaction n'a rien mis à jour, la révision a bougé. */
/** `classifySegment` rend `null` quand un axe manque ; ici les deux sont deja verifies. */
function requireSegment(segment: BddSegment | null): BddSegment {
  if (segment === null) throw segmentUnavailable();
  return segment;
}

const REV_MISMATCH = Symbol('rev-mismatch');

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA MIGRATION DE SEGMENT, ACTE EXPLICITE ET TRAÇABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BDD1..BDD4 se calculent par croisement du syndicat et de la banque : le
 * segment n'existe dans AUCUNE colonne. Faire passer un prospect de BDD3 à
 * BDD1 revient donc à écrire deux clés étrangères, et la modification
 * ordinaire le fait déjà — sans que rien ne subsiste de l'événement. Une fois
 * l'UPDATE passé, la fiche convertie est indiscernable d'une fiche née en
 * BDD1, et la question « combien de BDD3 avons-nous fait basculer ce mois, et
 * par qui » n'a plus de réponse, ni maintenant ni rétroactivement.
 *
 * Ce service est la réponse. Il ne se contente pas d'écrire la trace à côté de
 * la mise à jour : les deux partent dans la MÊME transaction, comme les
 * transitions de dossier bancaire. Une trace écrite à côté finit un jour par
 * mentir sur ce qu'elle prétend décrire — il suffit d'une coupure entre les
 * deux écritures.
 */
@Injectable()
export class SegmentChangeService {
  constructor(private readonly prisma: PrismaService) {}

  async migrate(
    user: AuthenticatedUser,
    id: string,
    input: ChangeProspectSegmentDto,
  ): Promise<ProspectDto> {
    const existing = await this.prisma.prospect.findFirst({
      where: { id, deletedAt: null },
      include: PROSPECT_INCLUDE,
    });
    if (!existing) throw prospectNotFound();
    assertOwnership(user, existing);

    // On ne bascule pas un segment qui n'existe pas. Une fiche sans banque ni
    // syndicat n'est dans aucun BDD : il faut d'abord la renseigner, et c'est
    // une correction de saisie, pas un changement de segment.
    const { banque, syndicat, banqueId: fromBanqueId, syndicatId: fromSyndicatId } = existing;
    if (banque === null || syndicat === null || fromBanqueId === null || fromSyndicatId === null) {
      throw segmentUnavailable();
    }

    // Le segment AVANT, calculé par la définition PARTAGÉE et non par une
    // reformulation locale : une seconde définition finirait par diverger, et
    // l'histoire enregistrée ne décrirait plus les mêmes populations que les
    // listes et les exports.
    const fromSegment: BddSegment = requireSegment(
      classifySegment({ syndicatSigle: syndicat.sigle, banqueShortName: banque.shortName }),
    );

    const toBanqueId = input.banqueId ?? fromBanqueId;
    const toSyndicatId = input.syndicatId ?? fromSyndicatId;

    // Le refus porte sur les CLÉS, pas sur le segment obtenu. Passer d'une
    // banque non-CBAO à une autre laisse la fiche en BDD4 et mérite quand même
    // sa ligne : c'est un changement réel, dont on veut pouvoir retrouver
    // l'auteur. Seul le geste qui ne change rien est refusé.
    if (toBanqueId === fromBanqueId && toSyndicatId === fromSyndicatId) {
      throw segmentUnchanged(fromSegment);
    }

    const banqueShortName =
      toBanqueId === fromBanqueId ? banque.shortName : await this.resolveBanque(toBanqueId);
    const syndicatSigle =
      toSyndicatId === fromSyndicatId
        ? syndicat.sigle
        : await this.resolveSyndicat(toSyndicatId);

    const toSegment = requireSegment(classifySegment({ syndicatSigle, banqueShortName }));

    const outcome = await this.prisma.$transaction(async (tx) => {
      // La garde de révision est DANS la mise à jour, jamais avant : une
      // lecture suivie d'une écriture laisserait une fenêtre où deux
      // utilisateurs passent tous les deux le contrôle et se convertissent la
      // fiche l'un sur l'autre. Ici c'est PostgreSQL qui arbitre.
      const updated = await tx.prospect.updateMany({
        where: { id, rev: input.expectedRev, deletedAt: null },
        data: { banqueId: toBanqueId, syndicatId: toSyndicatId, rev: { increment: 1 } },
      });
      if (updated.count === 0) return REV_MISMATCH;

      await tx.segmentChange.create({
        data: {
          prospectId: id,
          fromSegment,
          toSegment,
          fromBanqueId,
          toBanqueId,
          fromSyndicatId,
          toSyndicatId,
          reason: input.reason.trim(),
          changedById: user.id,
          // WEB en dur, et non un paramètre : cette opération EST celle du
          // panel. Le jour où le mobile saura convertir, il passera par sa
          // propre entrée et écrira MOBILE ; laisser le canal se déclarer
          // depuis le corps de la requête permettrait à n'importe quel appelant
          // de se faire passer pour l'autre.
          source: ChangeSource.WEB,
          // La trace suit SA FICHE, pas le mode en vigueur à la seconde du
          // clic : une bascule non marquée sur un prospect de démonstration
          // entrerait dans le décompte réel des conversions du mois.
          isDemo: existing.isDemo,
        },
      });
      return null;
    });

    if (outcome === REV_MISMATCH) {
      const current = await this.prisma.prospect.findUnique({
        where: { id },
        select: { rev: true },
      });
      throw prospectRevConflict(current?.rev ?? input.expectedRev);
    }

    const saved = await this.prisma.prospect.findFirst({
      where: { id },
      include: PROSPECT_INCLUDE,
    });
    if (!saved) throw prospectNotFound();
    // La fiche peut déjà porter des tentatives d'appel : les omettre ici
    // renverrait une réponse qui contredit la liste dont l'écran vient.
    const attempts = await lastAttemptsByProspect(this.prisma, [saved.id]);
    return toProspectDto(saved, attempts.get(saved.id));
  }

  /**
   * L'historique d'UNE fiche, du plus récent au plus ancien.
   *
   * Sert l'index `(prospectId, changedAt)`. La lecture n'est PAS bornée par le
   * mode démonstration : le prospect vient d'être résolu par sa clé primaire et
   * son cloisonnement s'est joué là. Rejouer un filtre ici rendrait une fiche
   * sans son historique, ce qui se lit à l'écran comme une fiche jamais
   * convertie.
   */
  async history(user: AuthenticatedUser, id: string): Promise<SegmentChangeListDto> {
    const prospect = await this.prisma.prospect.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, createdById: true },
    });
    if (!prospect) throw prospectNotFound();
    assertOwnership(user, prospect);

    // LECTURE GLOBALE délibérée : l'historique d'une fiche DÉJÀ résolue par sa
    // clé primaire juste au-dessus, et dont le cloisonnement s'est joué là. Une
    // trace suit toujours la nature de son prospect ; filtrer ici rendrait donc
    // soit exactement le même ensemble, soit une fiche de démonstration privée
    // de son histoire, ce qui se lit à l'écran comme une fiche jamais convertie.
    const rows = await this.prisma.segmentChange.findMany({
      where: { prospectId: id },
      include: { changedBy: { select: { id: true, fullName: true } } },
      // `id` en second critère : deux bascules de la même milliseconde
      // s'échangeraient sinon leur place d'un affichage à l'autre.
      orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
    });

    return { items: rows.map(toSegmentChangeDto) };
  }

  private async resolveBanque(banqueId: string): Promise<string> {
    const banque = await this.prisma.banque.findUnique({
      where: { id: banqueId },
      // `shortName` et non `name` : c'est lui qui porte l'axe CBAO de la
      // segmentation.
      select: { shortName: true },
    });
    if (!banque) throw banqueNotFound(banqueId);
    return banque.shortName;
  }

  private async resolveSyndicat(syndicatId: string): Promise<string> {
    const syndicat = await this.prisma.syndicat.findUnique({
      where: { id: syndicatId },
      select: { sigle: true },
    });
    if (!syndicat) throw syndicatNotFound(syndicatId);
    return syndicat.sigle;
  }
}

/** Ligne de bascule telle que la lisent l'historique et le tableau de bord. */
export interface SegmentChangeRow {
  id: string;
  prospectId: string;
  fromSegment: BddSegment;
  toSegment: BddSegment;
  fromBanqueId: string;
  toBanqueId: string;
  fromSyndicatId: string;
  toSyndicatId: string;
  reason: string | null;
  changedById: string;
  changedBy: { id: string; fullName: string };
  source: ChangeSource;
  changedAt: Date;
}

export function toSegmentChangeDto(row: SegmentChangeRow): SegmentChangeDto {
  return {
    id: row.id,
    prospectId: row.prospectId,
    fromSegment: row.fromSegment,
    toSegment: row.toSegment,
    fromBanqueId: row.fromBanqueId,
    toBanqueId: row.toBanqueId,
    fromSyndicatId: row.fromSyndicatId,
    toSyndicatId: row.toSyndicatId,
    reason: row.reason,
    changedById: row.changedById,
    changedByName: row.changedBy.fullName,
    source: row.source,
    changedAt: row.changedAt.toISOString(),
  };
}
