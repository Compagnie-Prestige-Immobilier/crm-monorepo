import { ApiProperty } from '@nestjs/swagger';

import type { DumpStatus } from './db-dump.job.js';

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
      'Issue de l’avis de fin. `INBOX_ONLY` : l’avis est dans la boîte de ' +
      'réception du panel, et c’est le SEUL canal. Aucun e-mail n’est envoyé ' +
      'pour cet avis : la sélection des destinataires d’e-mail ne retient que ' +
      'les comptes COMMERCIAL, et le demandeur d’un export est toujours un ' +
      'ADMIN. `FAILED` : l’avis n’a pas pu être écrit, et l’export est prêt ' +
      'quand même. Un export prêt dont personne n’a été prévenu doit se voir, ' +
      'pas se deviner.',
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
