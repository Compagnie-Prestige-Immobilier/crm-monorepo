import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { BddSegment } from '@crm/database';

export const ProspectSegmentError = {
  NOT_FOUND: 'PROSPECT_NOT_FOUND',
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

/** Une fiche sans banque ni syndicat n'est dans aucun segment : rien a basculer. */
export const segmentUnavailable = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'PROSPECT_SEGMENT_UNAVAILABLE',
    message:
      'Cette fiche n’a pas de banque ou de syndicat : renseignez-les d’abord, un segment ne se devine pas.',
  });

export const segmentUnchanged = (segment: BddSegment): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: ProspectSegmentError.UNCHANGED,
    message: `Ni la banque ni le syndicat ne changent : la fiche reste en ${segment}. Une migration de segment doit modifier au moins l’une des deux clés.`,
    segment,
  });

export const prospectRevConflict = (currentRev: number): ConflictException =>
  new ConflictException({
    code: ProspectSegmentError.REV_CONFLICT,
    message:
      'La fiche a été modifiée entre-temps par un autre utilisateur. Rechargez-la et vérifiez son segment avant de réessayer.',
    currentRev,
  });

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
