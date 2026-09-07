import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

// Codes stables, publiés dans l'OpenAPI et filtrés par le web et le mobile : les renommer casse
// les clients. Aucune de ces situations n'est un 500, le demandeur doit pouvoir agir dessus.
const ClientRequestError = {
  NOT_FOUND: 'CLIENT_REQUEST_NOT_FOUND',
  ALREADY_REVIEWED: 'CLIENT_REQUEST_ALREADY_REVIEWED',
  ALREADY_PENDING: 'CLIENT_REQUEST_ALREADY_PENDING',
  PROSPECT_EXISTS: 'CLIENT_REQUEST_PROSPECT_EXISTS',
  REPRESENTANT_NOT_FOUND: 'CLIENT_REQUEST_REPRESENTANT_NOT_FOUND',
  SYNDICAT_NOT_FOUND: 'CLIENT_REQUEST_SYNDICAT_NOT_FOUND',
  BANQUE_NOT_FOUND: 'CLIENT_REQUEST_BANQUE_NOT_FOUND',
} as const;

export const clientRequestNotFound = (): NotFoundException =>
  new NotFoundException({
    code: ClientRequestError.NOT_FOUND,
    message: 'Demande de création introuvable.',
  });

export const clientRequestAlreadyReviewed = (status: string): ConflictException =>
  new ConflictException({
    code: ClientRequestError.ALREADY_REVIEWED,
    message: 'Cette demande a déjà été arbitrée.',
    status,
  });

export const clientRequestAlreadyPending = (existingId: string): ConflictException =>
  new ConflictException({
    code: ClientRequestError.ALREADY_PENDING,
    message: 'Une demande est déjà en attente pour ce numéro.',
    existingId,
  });

export const clientRequestProspectExists = (phoneE164: string): ConflictException =>
  new ConflictException({
    code: ClientRequestError.PROSPECT_EXISTS,
    message: 'Un prospect porte déjà ce numéro. Recherchez-le par son téléphone.',
    phoneE164,
  });

export const representantNotFound = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: ClientRequestError.REPRESENTANT_NOT_FOUND,
    message: 'Le représentant de rattachement est introuvable.',
  });

export const syndicatNotFound = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: ClientRequestError.SYNDICAT_NOT_FOUND,
    message: 'Le syndicat choisi est introuvable.',
  });

export const banqueNotFound = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: ClientRequestError.BANQUE_NOT_FOUND,
    message: 'La banque demandeuse est introuvable.',
  });
