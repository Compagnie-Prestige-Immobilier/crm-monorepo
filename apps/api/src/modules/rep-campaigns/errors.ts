import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * Erreurs métier des campagnes d'appels aux représentants.
 *
 * Les codes portent le préfixe `REP_CAMPAIGN_` et non `PHASE2_` : ce sont deux
 * modules distincts, et un client qui traite « campagne introuvable » doit
 * pouvoir dire LAQUELLE. Partager les codes obligerait à lire le chemin de la
 * requête pour interpréter la réponse.
 */
export const RepCampaignError = {
  NOT_FOUND: 'REP_CAMPAIGN_NOT_FOUND',
  COMMERCIAL_NOT_FOUND: 'REP_CAMPAIGN_COMMERCIAL_NOT_FOUND',
  NOT_A_COMMERCIAL: 'REP_CAMPAIGN_NOT_A_COMMERCIAL',
  COMMERCIAL_INACTIVE: 'REP_CAMPAIGN_COMMERCIAL_INACTIVE',
  NO_ELIGIBLE_REPRESENTANT: 'REP_CAMPAIGN_NO_ELIGIBLE_REPRESENTANT',
  REPRESENTANT_ALREADY_ASSIGNED: 'REP_CAMPAIGN_REPRESENTANT_ALREADY_ASSIGNED',
  PROGRAMME_NOT_FOUND: 'REP_CAMPAIGN_PROGRAMME_NOT_FOUND',
  DAY_NOT_FOUND: 'REP_CAMPAIGN_DAY_NOT_FOUND',
  REPRESENTANT_NOT_FOUND: 'REP_CAMPAIGN_REPRESENTANT_NOT_FOUND',
  COMMENT_REQUIRED: 'REP_CAMPAIGN_COMMENT_REQUIRED',
  PROMISED_NOT_ALLOWED: 'REP_CAMPAIGN_PROMISED_NOT_ALLOWED',
} as const;

export const repCampaignNotFound = (): NotFoundException =>
  new NotFoundException({ code: RepCampaignError.NOT_FOUND, message: 'Campagne introuvable.' });

/**
 * 422 et non 400 : la requête est BIEN FORMÉE.
 *
 * Un identifiant de commercial syntaxiquement valide qui ne désigne aucun
 * compte, ou un compte au mauvais rôle, ou un compte désactivé, ne sont pas
 * des fautes de syntaxe : le serveur a parfaitement compris la demande et la
 * refuse pour une raison métier. Le module des demandes clients tranchait déjà
 * ainsi (`CLIENT_REQUEST_BANQUE_NOT_FOUND` en 422) : deux statuts pour la même
 * classe de faute obligeaient chaque client à connaître le module avant de
 * savoir s'il devait relire sa saisie ou corriger sa sélection.
 */
export const commercialNotFound = (userIds: readonly string[]): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: RepCampaignError.COMMERCIAL_NOT_FOUND,
    message: 'Un ou plusieurs comptes destinataires sont introuvables.',
    userIds,
  });

export const notACommercial = (userIds: readonly string[]): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: RepCampaignError.NOT_A_COMMERCIAL,
    message: 'Seuls des comptes COMMERCIAL peuvent recevoir un programme d’appels.',
    userIds,
  });

export const commercialInactive = (userIds: readonly string[]): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: RepCampaignError.COMMERCIAL_INACTIVE,
    message: 'Un ou plusieurs comptes destinataires sont désactivés.',
    userIds,
  });

export const noEligibleRepresentant = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: RepCampaignError.NO_ELIGIBLE_REPRESENTANT,
    message:
      'Aucun représentant éligible sur ce périmètre : tous sont déjà affectés à une campagne en cours.',
  });

/**
 * Deux administrateurs qui créent une campagne en même temps se heurtent à
 * l'index unique partiel `rep_call_tasks_one_active_per_representant`, ce qui
 * est exactement le comportement voulu. Sans cette traduction, l'un des deux
 * reçoit un 500 et ne peut rien en faire.
 */
export const representantAlreadyAssigned = (): ConflictException =>
  new ConflictException({
    code: RepCampaignError.REPRESENTANT_ALREADY_ASSIGNED,
    message:
      'Des représentants de ce périmètre viennent d’être affectés à une autre campagne. Relancez la création : ils en seront exclus.',
  });

export const programmeNotFound = (): NotFoundException =>
  new NotFoundException({
    code: RepCampaignError.PROGRAMME_NOT_FOUND,
    message: 'Aucun programme pour ce commercial dans cette campagne.',
  });

export const dayNotFound = (spreadDays: number): NotFoundException =>
  new NotFoundException({
    code: RepCampaignError.DAY_NOT_FOUND,
    message: `Cette campagne est étalée sur ${String(spreadDays)} journée(s).`,
  });

export const representantNotFound = (): NotFoundException =>
  new NotFoundException({
    code: RepCampaignError.REPRESENTANT_NOT_FOUND,
    message: 'Représentant introuvable.',
  });

export const commentRequired = (): BadRequestException =>
  new BadRequestException({
    code: RepCampaignError.COMMENT_REQUIRED,
    message: 'L’issue « Autre » exige un commentaire : sans lui, la case ne dit rien.',
  });

export const promisedNotAllowed = (): BadRequestException =>
  new BadRequestException({
    code: RepCampaignError.PROMISED_NOT_ALLOWED,
    message: 'Un nombre de fiches promises n’est admis que pour l’issue PROSPECTS_PROMISED.',
  });
