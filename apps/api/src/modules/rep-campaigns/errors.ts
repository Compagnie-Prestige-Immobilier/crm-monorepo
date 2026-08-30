import { BadRequestException, NotFoundException } from '@nestjs/common';

const error = (code: string, message: string): BadRequestException =>
  new BadRequestException({ code, message });

export const representantNotFound = (): NotFoundException =>
  new NotFoundException({ code: 'REPRESENTANT_NOT_FOUND', message: 'Représentant introuvable.' });

export const commentRequired = (): BadRequestException =>
  error('REP_CAMPAIGN_COMMENT_REQUIRED', 'L’issue « Autre » exige un commentaire : sans lui, la case ne dit rien.');

export const promisedNotAllowed = (): BadRequestException =>
  error(
    'REP_CAMPAIGN_PROMISED_NOT_ALLOWED',
    'Un nombre de fiches promises n’est admis que pour l’issue PROSPECTS_PROMISED.',
  );

export const callbackAtRequired = (): BadRequestException =>
  error('REP_CAMPAIGN_CALLBACK_AT_REQUIRED', 'L’issue « À rappeler » exige une date de rappel.');

export const callbackAtNotAllowed = (): BadRequestException =>
  error(
    'REP_CAMPAIGN_CALLBACK_AT_NOT_ALLOWED',
    'Une date de rappel n’est admise que pour l’issue CALLBACK.',
  );
