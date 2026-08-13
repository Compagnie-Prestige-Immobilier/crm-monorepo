import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

/**
 * Erreurs métier du module, toutes portées par un `code` stable.
 *
 * Aucune de ces situations n'est un 500. Un compositeur qui reçoit
 * « erreur interne » ne peut rien corriger ; un compositeur qui reçoit
 * NOTIFICATION_AUDIENCE_EMPTY sait exactement quoi changer.
 */
export const NotificationError = {
  NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  NOT_SCHEDULED: 'NOTIFICATION_NOT_SCHEDULED',
  ALREADY_SENT: 'NOTIFICATION_ALREADY_SENT',
  AUDIENCE_EMPTY: 'NOTIFICATION_AUDIENCE_EMPTY',
  AUDIENCE_ROLE_REQUIRED: 'NOTIFICATION_AUDIENCE_ROLE_REQUIRED',
  AUDIENCE_DEPARTEMENT_REQUIRED: 'NOTIFICATION_AUDIENCE_DEPARTEMENT_REQUIRED',
  AUDIENCE_USERS_REQUIRED: 'NOTIFICATION_AUDIENCE_USERS_REQUIRED',
  SCHEDULE_IN_PAST: 'NOTIFICATION_SCHEDULE_IN_PAST',
  TEMPLATE_NOT_FOUND: 'NOTIFICATION_TEMPLATE_NOT_FOUND',
  TEMPLATE_NAME_CONFLICT: 'NOTIFICATION_TEMPLATE_NAME_CONFLICT',
  TEMPLATE_VARIABLES_MISSING: 'NOTIFICATION_TEMPLATE_VARIABLES_MISSING',
  DELIVERY_NOT_FOUND: 'NOTIFICATION_DELIVERY_NOT_FOUND',
  ROUTE_INVALID: 'NOTIFICATION_ROUTE_INVALID',
} as const;

export const notificationNotFound = (): NotFoundException =>
  new NotFoundException({
    code: NotificationError.NOT_FOUND,
    message: 'Notification introuvable.',
  });

export const templateNotFound = (): NotFoundException =>
  new NotFoundException({
    code: NotificationError.TEMPLATE_NOT_FOUND,
    message: 'Gabarit introuvable.',
  });

export const templateNameConflict = (name: string): ConflictException =>
  new ConflictException({
    code: NotificationError.TEMPLATE_NAME_CONFLICT,
    message: `Un gabarit nommé « ${name} » existe déjà.`,
  });

/**
 * Annuler n'a de sens que sur un envoi encore à venir. Une notification déjà
 * partie ne se rappelle pas : le téléphone l'a. Refuser explicitement vaut
 * mieux que marquer CANCELLED une chose que 400 personnes ont déjà lue.
 */
export const notScheduled = (): ConflictException =>
  new ConflictException({
    code: NotificationError.NOT_SCHEDULED,
    message: 'Seule une notification encore programmée peut être annulée.',
  });

export const audienceEmpty = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: NotificationError.AUDIENCE_EMPTY,
    message: 'Ce public ne correspond à aucun compte actif. Rien n’a été envoyé.',
  });

export const audienceRoleRequired = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: NotificationError.AUDIENCE_ROLE_REQUIRED,
    message: 'Un public « par rôle » exige `audienceRole`.',
  });

export const audienceDepartementRequired = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: NotificationError.AUDIENCE_DEPARTEMENT_REQUIRED,
    message: 'Un public « par département » exige `audienceDepartementId`.',
  });

export const audienceUsersRequired = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: NotificationError.AUDIENCE_USERS_REQUIRED,
    message: 'Un public « comptes choisis » exige au moins un identifiant.',
  });

export const scheduleInPast = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: NotificationError.SCHEDULE_IN_PAST,
    message: 'La date de programmation est déjà passée.',
  });

/**
 * Le mobile passe cette chaîne telle quelle à `go_router`. Une valeur qui
 * commence par `http` ouvrirait un navigateur, ou pire, servirait de vecteur
 * d'hameçonnage depuis une notification qui porte le logo de l'application.
 */
export const routeInvalid = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: NotificationError.ROUTE_INVALID,
    message: 'Le lien profond doit être une route interne commençant par « / ».',
  });

export const templateVariablesMissing = (
  missing: readonly string[],
): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: NotificationError.TEMPLATE_VARIABLES_MISSING,
    message: `Variables non fournies : ${missing.join(', ')}.`,
    missing,
  });
