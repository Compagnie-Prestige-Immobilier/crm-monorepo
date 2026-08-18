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
  @ApiProperty({ type: String, nullable: true }) departementName!: string | null;

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
