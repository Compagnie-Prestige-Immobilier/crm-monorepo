import { ApiProperty } from '@nestjs/swagger';

import type { DumpStatus } from './db-dump.job.js';

/**
 * L'état d'un export intégral, tel que l'écran des paramètres le sonde.
 *
 * TOUS les champs facultatifs sont déclarés `nullable` et NON optionnels : le
 * serveur envoie toujours la clé. Un champ optionnel ferait engendrer côté Dart
 * un type non-nullable, et la désérialisation échouerait sur le premier `null`
 * reçu, c'est-à-dire immédiatement, puisqu'un travail qui vient d'être créé n'a
 * ni fichier, ni taille, ni échéance.
 */
export class DatabaseDumpJobDto {
  @ApiProperty({
    description: 'Absent tant qu’aucun export n’a jamais été demandé.',
    type: String,
    nullable: true,
    format: 'uuid',
  })
  id!: string | null;

  @ApiProperty({
    enum: ['idle', 'queued', 'running', 'ready', 'failed', 'expired'],
    description:
      '`idle` : aucun export n’a jamais été demandé. `queued` puis `running` : ' +
      'le travail court, l’écran affiche son attente. `ready` : le fichier est ' +
      'téléchargeable. `failed` : le motif est dans `failureReason`. `expired` : ' +
      'le fichier a été détruit, par échéance ou après téléchargement ; ce n’est ' +
      'pas une erreur.',
  })
  status!: DumpStatus | 'idle';

  @ApiProperty({ type: String, nullable: true }) requestedByName!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  requestedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  finishedAt!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Taille de l’archive compressée, en octets.',
  })
  fileSize!: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Empreinte de l’archive, à vérifier après téléchargement.',
  })
  sha256!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date-time',
    description: 'Au-delà, le fichier est détruit. Il l’est aussi dès qu’il a été téléchargé.',
  })
  expiresAt!: string | null;

  @ApiProperty({ type: String, nullable: true }) failureReason!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Issue de l’avis de fin. `SENT` : l’e-mail est parti. `NOT_CONFIGURED` : ' +
      'aucun compte Brevo n’est branché, l’export est prêt et seule la boîte de ' +
      'réception le signale. `TRANSPORT_ERROR` : Brevo a refusé. Un export prêt ' +
      'dont personne n’a été prévenu doit se voir, pas se deviner.',
  })
  noticeStatus!: string | null;

  @ApiProperty({ type: String, nullable: true }) noticeDetail!: string | null;

  @ApiProperty({
    description:
      'Vrai quand le fichier est servi par GET /admin/database-dump/download. ' +
      'Le téléchargement le détruit.',
  })
  downloadable!: boolean;
}
