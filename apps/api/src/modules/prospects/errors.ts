import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { BddSegment } from '@crm/database';

/**
 * Erreurs de la MIGRATION DE SEGMENT, toutes typées par un `code` stable.
 *
 * Elles vivent à part du service pour la même raison que dans Banque &
 * Financement : un refus métier qui remonte nu devient « erreur interne » à
 * l'écran, et l'utilisateur ne sait alors pas s'il doit corriger sa saisie,
 * recharger la fiche, ou appeler quelqu'un.
 */

export const ProspectSegmentError = {
  NOT_FOUND: 'PROSPECT_NOT_FOUND',
  /** Les deux clés sont restées les mêmes : il n'y a rien à tracer. */
  UNCHANGED: 'PROSPECT_SEGMENT_UNCHANGED',
  REV_CONFLICT: 'PROSPECT_REV_CONFLICT',
  BANQUE_NOT_FOUND: 'PROSPECT_BANQUE_NOT_FOUND',
  SYNDICAT_NOT_FOUND: 'PROSPECT_SYNDICAT_NOT_FOUND',
} as const;

export const prospectNotFound = (): NotFoundException =>
  new NotFoundException({
    code: ProspectSegmentError.NOT_FOUND,
    message: 'Prospect introuvable.',
  });

/**
 * 422 et non 400 : la requête est BIEN FORMÉE, elle ne demande simplement
 * aucun changement.
 *
 * Écrire quand même produirait une ligne de `SegmentChange` disant « de BDD3
 * vers BDD3, sans qu'aucune clé n'ait bougé », avec un motif rédigé par
 * quelqu'un qui croyait avoir converti une fiche. Le décompte des conversions
 * du mois est exactement ce que cette table existe pour porter : une seule
 * ligne vide suffit à le rendre faux, et rien ne permettrait ensuite de la
 * distinguer d'une vraie.
 */
export const segmentUnchanged = (segment: BddSegment): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: ProspectSegmentError.UNCHANGED,
    message: `Ni la banque ni le syndicat ne changent : la fiche reste en ${segment}. Une migration de segment doit modifier au moins l’une des deux clés.`,
    segment,
  });

/**
 * Conflit de révision, avec la révision COURANTE dans le corps.
 *
 * Même contrat que `BANK_CASE_REV_CONFLICT` : l'écran peut dire ce qui a
 * changé au lieu de demander un rechargement à l'aveugle. Sur une bascule de
 * segment, cela compte doublement : la fiche que l'autre utilisateur vient de
 * modifier n'est peut-être plus celle qu'on croyait convertir.
 */
export const prospectRevConflict = (currentRev: number): ConflictException =>
  new ConflictException({
    code: ProspectSegmentError.REV_CONFLICT,
    message:
      'La fiche a été modifiée entre-temps par un autre utilisateur. Rechargez-la et vérifiez son segment avant de réessayer.',
    currentRev,
  });

/**
 * 422 et non 404 : l'identifiant est un UUID valide, il ne désigne aucune
 * ligne du référentiel. Même classe de faute que `BANK_CASE_BANK_NOT_FOUND`,
 * et le 404 est réservé au prospect lui-même.
 */
export const banqueNotFound = (banqueId: string): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: ProspectSegmentError.BANQUE_NOT_FOUND,
    message: 'Banque de destination inconnue.',
    banqueId,
  });

export const syndicatNotFound = (syndicatId: string): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: ProspectSegmentError.SYNDICAT_NOT_FOUND,
    message: 'Syndicat de destination inconnu.',
    syndicatId,
  });
