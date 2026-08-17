import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';

export enum SupervisionGranularity {
  DAY = 'day',
  WEEK = 'week',
}

export class SupervisionQueryDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Borne basse sur la date de l’ACTE, incluse : heure d’appel, de saisie ou de ' +
      'clôture relevée chez le client, et non date d’arrivée en base. Une date seule ' +
      '(AAAA-MM-JJ) démarre à minuit, fuseau Africa/Dakar.',
  })
  @IsOptional()
  @IsISO8601()
  actFrom?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne haute sur la date de l’acte, incluse. Une date seule finit à 23:59:59.999.',
  })
  @IsOptional()
  @IsISO8601()
  actTo?: string;

  @ApiPropertyOptional({
    enum: SupervisionGranularity,
    enumName: 'SupervisionGranularity',
    default: SupervisionGranularity.DAY,
  })
  @IsOptional()
  @IsEnum(SupervisionGranularity)
  granularity?: SupervisionGranularity;
}

export class SupervisionActivityRowDto {
  @ApiProperty({ description: 'Début de la journée ou de la semaine, en AAAA-MM-JJ.' })
  bucket!: string;

  @ApiProperty({ format: 'uuid' }) teleconseillerId!: string;
  @ApiProperty() teleconseillerName!: string;

  @ApiProperty({ type: Number, description: 'Appels passés à des prospects.' }) calls!: number;
  @ApiProperty({ type: Number, description: 'Issue UNREACHABLE : NRP ou injoignable.' })
  unreachable!: number;

  @ApiProperty({ type: Number, description: 'Issue WRONG_NUMBER : faux numéro.' })
  wrongNumber!: number;

  @ApiProperty({ type: Number, description: 'Issue REFUSED : refus.' }) refused!: number;
  @ApiProperty({ type: Number, description: 'Issue OTHER.' }) other!: number;
  @ApiProperty({ type: Number, description: 'Issue METHOD_OBTAINED.' }) methodObtained!: number;
  @ApiProperty({ type: Number, description: 'Issue CALLBACK : à rappeler.' }) callback!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Part des appels dont le numéro s’est révélé exploitable, en pourcentage. ' +
      '`null` sans aucun appel : « personne appelé » n’est pas « personne joint ».',
  })
  reachRate!: number | null;

  @ApiProperty({ type: Number, description: 'Fiches prospect saisies sur la période.' })
  prospectsCreated!: number;

  @ApiProperty({ type: Number, description: 'Représentants distincts appelés sur la période.' })
  representantsContacted!: number;

  @ApiProperty({ type: Number, description: 'Tâches d’appel clôturées sur la période.' })
  tasksClosed!: number;
}

export class SupervisionTeleconseillerDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: Boolean }) isActive!: boolean;

  @ApiProperty({
    type: Number,
    description: 'Tâches d’appel encore OUVERTES. Instantané : la fenêtre ne le borne pas.',
  })
  openTasks!: number;
}

export class SupervisionActivityDto {
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) from!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) to!: string | null;

  @ApiProperty({ enum: SupervisionGranularity, enumName: 'SupervisionGranularity' })
  granularity!: SupervisionGranularity;

  @ApiProperty({
    type: () => [SupervisionActivityRowDto],
    description:
      'Une ligne par téléconseiller et par période, seulement là où il s’est passé quelque chose.',
  })
  items!: SupervisionActivityRowDto[];

  @ApiProperty({
    type: () => [SupervisionTeleconseillerDto],
    description: 'Tous les téléconseillers, y compris ceux sans aucun acte sur la fenêtre.',
  })
  teleconseillers!: SupervisionTeleconseillerDto[];
}
