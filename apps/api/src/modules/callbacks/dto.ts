import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Projet } from '@crm/database';

export enum CallbackScope {
  TODAY = 'today',
  OVERDUE = 'overdue',
  WEEK = 'week',
}

export class CallbackQueryDto {
  @ApiPropertyOptional({ enum: Projet, enumName: 'Projet' })
  @IsOptional()
  @IsEnum(Projet)
  projet?: Projet;

  @ApiPropertyOptional({
    enum: CallbackScope,
    enumName: 'CallbackScope',
    default: CallbackScope.TODAY,
    description:
      'today : tout ce qui est dû d’ici la fin de la journée, retards compris. ' +
      'overdue : les seuls retards. week : les sept prochaines journées.',
  })
  @IsOptional()
  @IsEnum(CallbackScope)
  scope?: CallbackScope;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'File d’un téléconseiller donné. Réservé à l’administration et à la supervision ; ' +
      'ignoré pour les autres, qui ne voient que la leur.',
  })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}

export class CallbackDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) prospectId!: string;

  @ApiProperty({ description: 'Code court à six caractères du prospect.' }) shortCode!: string;
  @ApiProperty() phoneE164!: string;

  @ApiProperty({ type: String, format: 'date-time' }) scheduledAt!: string;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;

  @ApiProperty({ format: 'uuid' }) assignedToId!: string;
  @ApiProperty() assignedToName!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true }) campaignId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) taskId!: string | null;

  @ApiProperty({
    type: Boolean,
    description:
      'Le rappel est passé. État DÉRIVÉ de scheduledAt et de l’heure du serveur, jamais stocké.',
  })
  overdue!: boolean;
}

export class CallbackListDto {
  @ApiProperty({ type: () => [CallbackDto], description: 'Du plus ancien au plus récent.' })
  items!: CallbackDto[];

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Heure du serveur ayant servi à décider du retard.',
  })
  serverTime!: string;
}
