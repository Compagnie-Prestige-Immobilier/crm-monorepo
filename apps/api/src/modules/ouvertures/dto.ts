import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsObject, IsOptional, IsUUID } from 'class-validator';

/** Un brouillon n'a pas de forme : le script d'un prospect et celui d'un
 * représentant ne portent pas les mêmes champs. */
export type OuvertureDraft = Record<string, unknown>;

export class OuvrirFicheDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'UUID v7 engendré par le client. Clé d’idempotence : l’ouverture existe sur l’appareil avant d’atteindre le serveur.',
  })
  @IsUUID()
  id!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Exclusif de `prospectId`.' })
  @IsOptional()
  @IsUUID()
  representantId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Exclusif de `representantId`.' })
  @IsOptional()
  @IsUUID()
  prospectId?: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Heure du terrain, comme `clientCreatedAt` ailleurs : une ouverture faite hors ligne lundi compte lundi.',
  })
  @IsISO8601()
  openedAt!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Réponses déjà saisies au moment de l’ouverture.',
  })
  @IsOptional()
  @IsObject()
  draft?: OuvertureDraft;
}

export class EnregistrerBrouillonDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Remplace le brouillon précédent en entier.',
  })
  @IsObject()
  draft!: OuvertureDraft;
}

export class OuvertureFicheDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) openedById!: string;
  @ApiProperty() openedByName!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) representantId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) prospectId!: string | null;
  @ApiProperty({ type: String, description: 'Nom de la fiche ouverte.' }) ficheNom!: string;
  @ApiProperty({ type: String, format: 'date-time' }) openedAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Nul tant que la fiche est verrouillée.',
  })
  closedAt!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Durée de traitement, lue entre les deux bornes et jamais stockée. Distincte de la durée de communication du journal d’appels.',
  })
  dureeSecondes!: number | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true }) closingAttemptId!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Réponses saisies, restituées au rappel et après un plantage.',
  })
  draft!: OuvertureDraft | null;

  @ApiProperty({ type: String, nullable: true }) releasedByName!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) releasedAt!: string | null;
}

export class OuvertureFicheListDto {
  @ApiProperty({
    type: () => [OuvertureFicheDto],
    description: 'De la plus ancienne à la plus récente.',
  })
  items!: OuvertureFicheDto[];
}

export class ComptageOuverturesQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date', description: 'Journée incluse.' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'Journée incluse.' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Un seul téléconseiller.' })
  @IsOptional()
  @IsUUID()
  openedById?: string;
}

export class ComptageOuverturesJourDto {
  @ApiProperty({ format: 'uuid' }) openedById!: string;
  @ApiProperty() openedByName!: string;
  @ApiProperty({ type: String, format: 'date', description: 'Journée de travail, Africa/Dakar.' })
  jour!: string;
  @ApiProperty({ type: Number }) ouvertures!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'DMT du jour, en secondes. Nulle tant qu’aucune ouverture n’est fermée.',
  })
  dureeMoyenneSecondes!: number | null;
}

export class ComptageOuverturesDto {
  @ApiProperty({
    type: () => [ComptageOuverturesJourDto],
    description: 'Une ligne par téléconseiller et par jour, de la plus récente à la plus ancienne.',
  })
  items!: ComptageOuverturesJourDto[];
}
