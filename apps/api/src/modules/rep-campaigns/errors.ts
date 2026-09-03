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

export const statutInconnu = (): BadRequestException =>
  error('REP_STATUT_QUALIFICATION_UNKNOWN', 'Ce statut de qualification n’existe pas.');

export const statutInactif = (label: string): BadRequestException =>
  error(
    'REP_STATUT_QUALIFICATION_INACTIVE',
    `Le statut « ${label} » a été retiré : choisissez-en un autre.`,
  );

/**
 * Le statut commande l'issue. Un client qui envoie les deux calcule la même
 * chose que le serveur : ce refus ne peut donc viser qu'un client fautif, et il
 * vaut mieux le dire que d'enregistrer une contradiction.
 */
export const issueContreditStatut = (attendue: string, recue: string): BadRequestException =>
  error(
    'REP_OUTCOME_STATUT_MISMATCH',
    `Le statut choisi impose l’issue « ${attendue} », or « ${recue} » a été envoyée.`,
  );
