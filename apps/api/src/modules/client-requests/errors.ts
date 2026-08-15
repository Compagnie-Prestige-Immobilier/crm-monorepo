import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

/**
 * Erreurs métier du module, toutes portées par un `code` stable.
 *
 * Aucune de ces situations n'est un 500. Une banque qui reçoit « erreur
 * interne » n'a plus qu'à renoncer ; une banque qui reçoit
 * CLIENT_REQUEST_PROSPECT_EXISTS apprend que le client est en base et peut
 * relancer sa recherche, ce qui est précisément l'impasse que ce module vient
 * lever.
 */
export const ClientRequestError = {
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

/**
 * Arbitrer deux fois la même demande n'est pas un rejeu inoffensif : la seconde
 * approbation créerait un SECOND prospect pour la même personne, que la
 * contrainte d'unicité du téléphone refuserait avec un message incompréhensible.
 * On refuse ici, avec le statut déjà atteint.
 */
export const clientRequestAlreadyReviewed = (status: string): ConflictException =>
  new ConflictException({
    code: ClientRequestError.ALREADY_REVIEWED,
    message: 'Cette demande a déjà été arbitrée.',
    status,
  });

/**
 * Une demande en attente sur le même numéro existe déjà.
 *
 * Deux agents de la même banque qui butent sur le même client absent le même
 * matin est le cas ORDINAIRE, pas l'exception. Empiler deux demandes
 * identiques ferait apparaître deux lignes à arbitrer pour une seule personne,
 * et la seconde approbation échouerait sur l'unicité du téléphone.
 */
export const clientRequestAlreadyPending = (existingId: string): ConflictException =>
  new ConflictException({
    code: ClientRequestError.ALREADY_PENDING,
    message: 'Une demande est déjà en attente pour ce numéro.',
    existingId,
  });

/**
 * Le prospect existe déjà : la recherche de l'agent a échoué pour une autre
 * raison (faute de frappe sur le nom, dossier pas encore enrôlé). Créer un
 * doublon serait la pire issue ; on renvoie de quoi le retrouver.
 */
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
