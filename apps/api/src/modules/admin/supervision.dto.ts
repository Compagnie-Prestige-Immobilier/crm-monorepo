import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@crm/database';

import { WorkShiftDto } from '../analytics/supervision.dto.js';
import { PerformanceScore } from './performance-score.js';
import { PRESENCE_ONLINE_WINDOW_MINUTES, type PresenceState } from './presence.js';

export const PRESENCE_STATES = ['ONLINE', 'RECENT', 'AWAY'] as const;

export class SupervisedUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() username!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: Role, enumName: 'Role' }) role!: Role;
  @ApiProperty({ type: Boolean }) isActive!: boolean;

  @ApiProperty({ enum: PRESENCE_STATES, enumName: 'PresenceState' })
  presence!: PresenceState;

  @ApiProperty({
    type: Boolean,
    description: 'Une famille de jetons est encore vivante : ni révoquée, ni expirée.',
  })
  hasLiveSession!: boolean;

  @ApiProperty({ type: Number, description: 'Sessions ouvertes, tous appareils confondus.' })
  sessionCount!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Trace d’activité la plus récente, toutes sources confondues.',
  })
  lastSeenAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastLoginAt!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Dernier lot de synchronisation reçu d’un appareil.',
  })
  lastSyncAt!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Dernière synchronisation descendante. Un appareil ouvert appelle toutes ' +
      'les minutes, même quand il n’a rien à remonter.',
  })
  lastPullAt!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Opérations en attente de remontée dans l’appareil, DÉCLARÉES PAR LUI. ' +
      '`null` quand l’application ne les annonce pas : le serveur ne voit pas ' +
      'ce qui dort dans un téléphone.',
  })
  pendingOps!: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Version de l’application mobile, telle qu’elle s’annonce.',
  })
  appVersion!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Dernière écriture métier : tentative d’appel ou transition de dossier. ' +
      'Cherchée sur les 31 derniers jours seulement ; au-delà, vaut null.',
  })
  lastWriteAt!: string | null;

  @ApiProperty({
    type: Number,
    description:
      'Temps actif observé aujourd’hui, en secondes. Les interruptions de plus de 90 secondes ne sont pas comptées.',
  })
  activeSecondsToday!: number;

  @ApiProperty({
    type: Number,
    description:
      'Part du temps actif tombée dans les créneaux de travail, en secondes. ' +
      'La présence est découpée à l’heure : une tranche compte dès que son ' +
      'heure de début appartient à un créneau, donc un créneau réglé à une ' +
      'demi-heure compte l’heure entière.',
  })
  activeSecondsInShifts!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  firstSeenToday!: string | null;

  @ApiProperty({
    type: Number,
    description:
      'Tentatives d’appel du jour, prospects et représentants confondus, ' +
      'comptées sur l’heure de l’appel et non sur celle de la remontée.',
  })
  callsToday!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Médiane, en secondes, de l’écart entre deux tentatives consécutives du ' +
      'jour. `null` en deçà de deux tentatives : un écart n’existe pas encore.',
  })
  medianGapSeconds!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Médiane, en secondes, du retard de remontée : temps écoulé entre ' +
      'l’appel sur le téléphone et son arrivée au serveur. Négatif quand ' +
      'l’horloge du téléphone avance sur celle du serveur. `null` sans ' +
      'aucune tentative du jour.',
  })
  medianUploadLagSeconds!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  firstCallAt!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Dernière tentative du jour. Avec `firstCallAt`, donne l’amplitude de la journée.',
  })
  lastCallAt!: string | null;

  @ApiProperty({
    type: Number,
    description:
      'Appels du jour ayant obtenu une réponse : prospect joignable (toute ' +
      'issue hors numéro injoignable ou faux numéro) et représentant qui a ' +
      'décroché, qu’il dise oui ou non.',
  })
  reachedToday!: number;

  @ApiProperty({
    type: Number,
    description:
      'Appels du jour ayant abouti : méthode obtenue côté prospect, ' +
      'représentant qualifié côté représentant. Un représentant appelé ' +
      'plusieurs fois ne compte qu’une fois, sur sa dernière réponse du jour.',
  })
  qualifiedToday!: number;

  @ApiProperty({
    type: Number,
    description:
      'Appels du jour au-delà du premier sur une même fiche. Zéro quand chaque ' +
      'fiche n’a été appelée qu’une fois.',
  })
  repeatCalls!: number;

  @ApiProperty({
    type: Number,
    description:
      'Temps mort, en secondes : somme des écarts de plus de quinze minutes ' +
      'entre deux appels consécutifs tombant dans le MÊME créneau. La pause ' +
      'entre les deux créneaux n’en est pas un.',
  })
  deadSeconds!: number;

  @ApiProperty({ type: Number, description: 'Nombre de trous comptés dans `deadSeconds`.' })
  deadGaps!: number;

  @ApiProperty({ type: () => PerformanceScore })
  score!: PerformanceScore;
}

export class PresenceCountsDto {
  @ApiProperty({ type: Number }) online!: number;
  @ApiProperty({ type: Number }) recent!: number;
  @ApiProperty({ type: Number }) away!: number;
}

export class SupervisionDto {
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Horloge du serveur au moment de la lecture.',
  })
  observedAt!: string;

  @ApiProperty({
    type: Number,
    default: PRESENCE_ONLINE_WINDOW_MINUTES,
    description: 'Fenêtre, en minutes, en deçà de laquelle un compte est dit connecté.',
  })
  onlineWindowMinutes!: number;

  @ApiProperty({
    type: Number,
    description:
      'Secondes de créneau déjà écoulées à `observedAt`, les deux créneaux ' +
      'cumulés. Zéro avant l’ouverture, plafonné à leur durée totale après.',
  })
  shiftSecondsElapsed!: number;

  @ApiProperty({
    type: () => [WorkShiftDto],
    description: 'Créneaux servant à ce calcul, pour les nommer sans un second appel.',
  })
  shifts!: WorkShiftDto[];

  @ApiProperty({ type: () => [SupervisedUserDto] })
  teleconseillers!: SupervisedUserDto[];

  @ApiProperty({ type: () => [SupervisedUserDto] })
  finances!: SupervisedUserDto[];

  @ApiProperty({ type: () => PresenceCountsDto })
  counts!: PresenceCountsDto;
}
