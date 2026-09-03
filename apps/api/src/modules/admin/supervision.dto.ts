import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@crm/database';

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

  @ApiProperty({ type: () => [SupervisedUserDto] })
  teleconseillers!: SupervisedUserDto[];

  @ApiProperty({ type: () => [SupervisedUserDto] })
  finances!: SupervisedUserDto[];

  @ApiProperty({ type: () => PresenceCountsDto })
  counts!: PresenceCountsDto;
}
