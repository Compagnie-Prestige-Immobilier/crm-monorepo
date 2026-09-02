import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

const error = (code: string, message: string): BadRequestException =>
  new BadRequestException({ code, message });

export const representantNotFound = (): NotFoundException =>
  new NotFoundException({ code: 'REPRESENTANT_NOT_FOUND', message: 'Représentant introuvable.' });

export const representantNotAssigned = (): ForbiddenException =>
  new ForbiddenException({
    code: 'REP_CAMPAIGN_NOT_ASSIGNED',
    message: 'Ce représentant n’est pas dans vos campagnes.',
  });

export const phoneConflict = (ownerName: string): ConflictException =>
  new ConflictException({
    code: 'REPRESENTANT_PHONE_CONFLICT',
    message: `Ce numéro est déjà celui d’un représentant enregistré par ${ownerName}.`,
  });

export const commentRequired = (): BadRequestException =>
  error(
    'REP_CAMPAIGN_COMMENT_REQUIRED',
    'L’issue « Autre » exige un commentaire : sans lui, la case ne dit rien.',
  );

export const promisedNotAllowed = (): BadRequestException =>
  error(
    'REP_CAMPAIGN_PROMISED_NOT_ALLOWED',
    'Un nombre de fiches promises n’est admis que pour l’issue PROSPECTS_PROMISED.',
  );

export const callbackAtRequired = (): BadRequestException =>
  error('REP_CAMPAIGN_CALLBACK_AT_REQUIRED', 'L’issue « À rappeler » exige une date de rappel.');
