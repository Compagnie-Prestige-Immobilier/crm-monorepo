import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

const NotificationError = {
  NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  NOT_SCHEDULED: 'NOTIFICATION_NOT_SCHEDULED',
  ALREADY_SENT: 'NOTIFICATION_ALREADY_SENT',
  AUDIENCE_EMPTY: 'NOTIFICATION_AUDIENCE_EMPTY',
  AUDIENCE_ROLE_REQUIRED: 'NOTIFICATION_AUDIENCE_ROLE_REQUIRED',
  AUDIENCE_DEPARTEMENT_RETIRED: 'NOTIFICATION_AUDIENCE_DEPARTEMENT_RETIRED',
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

export const audienceDepartementRetired = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: NotificationError.AUDIENCE_DEPARTEMENT_RETIRED,
    message: 'Le public « par département » n’existe plus : les comptes n’ont pas de département.',
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

export const routeInvalid = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: NotificationError.ROUTE_INVALID,
    message: 'Le lien profond doit être une route interne commençant par « / ».',
  });
