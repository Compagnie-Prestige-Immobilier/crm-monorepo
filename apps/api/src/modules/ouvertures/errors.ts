import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

const OuvertureErrorCode = {
  CIBLE_INVALIDE: 'OUVERTURE_CIBLE_INVALIDE',
  DEJA_OUVERTE: 'OUVERTURE_FICHE_DEJA_OUVERTE',
  INTROUVABLE: 'OUVERTURE_INTROUVABLE',
  DEJA_FERMEE: 'OUVERTURE_DEJA_FERMEE',
  FICHE_INTROUVABLE: 'OUVERTURE_FICHE_INTROUVABLE',
  ID_PRIS: 'OUVERTURE_ID_PRIS',
} as const;

export const cibleInvalide = (): BadRequestException =>
  new BadRequestException({
    code: OuvertureErrorCode.CIBLE_INVALIDE,
    message: 'Une ouverture porte sur un représentant OU sur un prospect, jamais sur les deux.',
  });

/**
 * Traduction de l'index unique partiel `ouvertures_fiche_verrou_unique`. La
 * base refuse la seconde ouverture ; sans cette traduction elle sortirait en
 * 500, alors que c'est le comportement voulu.
 */
export const dejaOuverte = (): ConflictException =>
  new ConflictException({
    code: OuvertureErrorCode.DEJA_OUVERTE,
    message: 'Une fiche est déjà ouverte. Qualifiez-la avant d’en ouvrir une autre.',
  });

export const ouvertureIntrouvable = (): NotFoundException =>
  new NotFoundException({
    code: OuvertureErrorCode.INTROUVABLE,
    message: 'Cette ouverture n’existe pas, ou elle appartient à un autre téléconseiller.',
  });

export const dejaFermee = (): ConflictException =>
  new ConflictException({
    code: OuvertureErrorCode.DEJA_FERMEE,
    message: 'Cette fiche a déjà été qualifiée ou libérée.',
  });

export const ficheIntrouvable = (): NotFoundException =>
  new NotFoundException({
    code: OuvertureErrorCode.FICHE_INTROUVABLE,
    message: 'Cette fiche n’existe pas, ou elle n’est pas dans vos campagnes.',
  });

export const idPris = (): ConflictException =>
  new ConflictException({
    code: OuvertureErrorCode.ID_PRIS,
    message: 'Cet identifiant d’ouverture appartient déjà à un autre téléconseiller.',
  });
