import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImportKind, ImportMode, ImportStatus } from '@crm/database';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';

export class ImportJobErrorDto {
  @ApiProperty({
    type: Number,
    description: 'Numéro de ligne DANS LE FICHIER, en-tête compris : ce qu’Excel affiche.',
  })
  rowNumber!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'En-tête de la colonne fautive, quand le refus en désigne une.',
  })
  column!: string | null;

  @ApiProperty({ description: 'Code stable du motif, pour que l’interface puisse le traduire.' })
  code!: string;

  @ApiProperty({ description: 'Motif lisible, prêt à afficher.' }) message!: string;
}

export class ImportJobReportDto {
  @ApiProperty({ enum: ImportKind, enumName: 'ImportKind' }) kind!: ImportKind;

  @ApiProperty({
    enum: ImportMode,
    enumName: 'ImportMode',
    description:
      'Le mode sous lequel ce rapport a été produit. En DRY_RUN, `createdRows` compte les lignes qui SERAIENT créées ; rien n’a été écrit.',
  })
  mode!: ImportMode;

  @ApiProperty({ type: Number, description: 'Lignes de données lues, en-tête et exemple exclus.' })
  totalRows!: number;

  @ApiProperty({ type: Number }) processedRows!: number;
  @ApiProperty({ type: Number }) createdRows!: number;

  @ApiProperty({
    type: Number,
    description: 'Lignes RÉÉCRITES. Seul l’aller-retour Excel du registre des visites en produit.',
  })
  updatedRows!: number;

  @ApiProperty({
    type: Number,
    description: 'Lignes écartées : doublons dans le fichier, ou déjà présentes en base.',
  })
  skippedRows!: number;

  @ApiProperty({ type: Number, description: 'Lignes refusées à l’analyse. Compte EXACT.' })
  errorRows!: number;

  @ApiProperty({
    type: Boolean,
    description:
      'Vrai quand `errors` ne montre qu’une partie des refus. Le compteur `errorRows`, lui, reste exact.',
  })
  truncated!: boolean;

  @ApiProperty({ type: Number, description: 'Longueur maximale de `errors`.' })
  maxReportedErrors!: number;

  @ApiProperty({ type: () => [ImportJobErrorDto] }) errors!: ImportJobErrorDto[];
}

export class ImportJobDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty({ enum: ImportKind, enumName: 'ImportKind' }) kind!: ImportKind;

  @ApiProperty({
    enum: ImportStatus,
    enumName: 'ImportStatus',
    description:
      '`queued` : le travail attend un travailleur. `running` : il court, `processedRows` avance. ' +
      '`succeeded` : terminé, le rapport est là. `failed` : le motif est dans `failureCode`. ' +
      '`expired` : le fichier déposé et le rapport ont été détruits à l’échéance ; ce n’est pas une erreur.',
  })
  status!: ImportStatus;

  @ApiProperty({
    enum: ImportMode,
    enumName: 'ImportMode',
    description:
      'DRY_RUN simule et n’écrit rien. APPLY écrit. Un import naît TOUJOURS en DRY_RUN : appliquer cinquante mille lignes sans les avoir vues ne se rattrape pas.',
  })
  mode!: ImportMode;

  @ApiProperty({ format: 'uuid' }) requestedById!: string;

  @ApiProperty({ description: 'Nom du fichier tel que téléversé. JAMAIS utilisé comme chemin.' })
  fileName!: string;

  @ApiProperty({ type: Number }) fileBytes!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Dénominateur de l’avancement. NUL tant que le travail n’a pas lu l’en-tête du classeur, et nul aussi quand la feuille ne déclare pas ses dimensions.',
  })
  totalRows!: number | null;

  @ApiProperty({ type: Number }) processedRows!: number;
  @ApiProperty({ type: Number }) createdRows!: number;

  @ApiProperty({
    type: Number,
    description: 'Lignes RÉÉCRITES. Seul l’aller-retour Excel du registre des visites en produit.',
  })
  updatedRows!: number;

  @ApiProperty({ type: Number }) skippedRows!: number;
  @ApiProperty({ type: Number }) errorRows!: number;

  @ApiProperty({ type: () => ImportJobReportDto, nullable: true })
  report!: ImportJobReportDto | null;

  @ApiProperty({ type: String, nullable: true }) failureCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) failureMsg!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  startedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  finishedAt!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Au-delà, le classeur déposé et le rapport sont détruits.',
  })
  expiresAt!: string;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class ImportJobListDto {
  @ApiProperty({ type: () => [ImportJobDto] }) items!: ImportJobDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export class ImportJobQueryDto {
  @ApiPropertyOptional({ enum: ImportKind, enumName: 'ImportKind' })
  @IsOptional()
  @IsEnum(ImportKind)
  kind?: ImportKind;

  @ApiPropertyOptional({ enum: ImportStatus, enumName: 'ImportStatus' })
  @IsOptional()
  @IsEnum(ImportStatus)
  status?: ImportStatus;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
