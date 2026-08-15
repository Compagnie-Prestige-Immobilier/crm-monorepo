import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ClientRequestStatus, EnrollmentMethod } from '@crm/database';

import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';

/** Longueur maximale d'une note libre, alignée sur les autres champs de texte. */
const NOTE_MAX_LENGTH = 2_000;

/**
 * Demande d'un agent Banque & Finance : « ce client n'existe pas, créez-le ».
 *
 * Le corps ne porte que l'identité, et c'est délibéré. Un agent bancaire ne
 * voit ni le représentant, ni le syndicat, ni le commercial propriétaire : lui
 * demander ces champs produirait des valeurs inventées, qui feraient ensuite
 * mentir toutes les statistiques par département et par apporteur. C'est
 * l'administrateur qui les complète au moment d'approuver.
 */
export class CreateClientRequestDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nom!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  prenom!: string;

  @ApiProperty({
    maxLength: 40,
    description: 'Téléphone en saisie libre. Normalisé en E.164 par le serveur.',
    example: '77 123 45 67',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Banque demandeuse. Elle devient la provenance lisible du prospect créé, pour que l’on puisse mesurer ce qui entre hors base.',
  })
  @IsUUID()
  banqueId!: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: NOTE_MAX_LENGTH,
    description: 'Contexte laissé à l’administrateur : référence du dossier, agence, urgence.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH)
  note?: string;
}

/**
 * Champs que SEUL l'administrateur peut renseigner.
 *
 * `representantId` et `syndicatId` sont obligatoires en base sur `Prospect` :
 * la demande ne peut donc pas aboutir sans eux. `enrollmentMethod` l'est tout
 * autant, parce que le prospect naît en `METHOD_OBTAINED` (sans quoi aucun
 * dossier ne pourrait s'y rattacher, voir la recherche banque) et qu'une
 * contrainte CHECK lie les deux colonnes.
 */
export class ApproveClientRequestDto {
  @ApiProperty({ format: 'uuid', description: 'Représentant de rattachement du prospect créé.' })
  @IsUUID()
  representantId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  syndicatId!: string;

  @ApiProperty({
    enum: EnrollmentMethod,
    enumName: 'EnrollmentMethod',
    description:
      'Méthode d’enrôlement du prospect créé. Obligatoire : le prospect naît en METHOD_OBTAINED, et une contrainte CHECK lie les deux colonnes.',
  })
  @IsEnum(EnrollmentMethod)
  enrollmentMethod!: EnrollmentMethod;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Banque du prospect créé. Par défaut celle de la demande.',
  })
  @IsOptional()
  @IsUUID()
  banqueId?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Date de saisie à retenir. Par défaut celle de la demande.',
  })
  @IsOptional()
  @IsISO8601()
  clientCreatedAt?: string;
}

export class RejectClientRequestDto {
  @ApiProperty({
    maxLength: NOTE_MAX_LENGTH,
    description:
      'Motif du refus, obligatoire et non vide. Un refus muet renvoie l’agent à son impasse de départ, ce que ce module existe précisément pour éviter.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(NOTE_MAX_LENGTH)
  reason!: string;
}

export class ClientRequestDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nom!: string;
  @ApiProperty() prenom!: string;
  @ApiProperty({ description: 'Téléphone normalisé E.164.' }) phoneE164!: string;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;

  @ApiProperty({ format: 'uuid' }) banqueId!: string;
  @ApiProperty() banqueName!: string;

  @ApiProperty({ format: 'uuid' }) requestedById!: string;
  @ApiProperty() requestedByName!: string;

  @ApiProperty({ enum: ClientRequestStatus, enumName: 'ClientRequestStatus' })
  status!: ClientRequestStatus;

  @ApiProperty({ type: String, format: 'uuid', nullable: true }) reviewedById!: string | null;
  @ApiProperty({ type: String, nullable: true }) reviewedByName!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) reviewedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) rejectionNote!: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Prospect issu de l’approbation. Nul tant que la demande n’a pas abouti.',
  })
  createdProspectId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class ClientRequestListDto {
  @ApiProperty({ type: () => [ClientRequestDto] }) items!: ClientRequestDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;

  @ApiProperty({
    type: Number,
    description:
      'Demandes encore en attente, TOUS filtres confondus. C’est ce nombre que porte la pastille du menu : filtré, il retomberait à zéro dès qu’un admin consulte l’onglet « approuvées ».',
  })
  pendingCount!: number;
}

export class ClientRequestQueryDto {
  @ApiPropertyOptional({ enum: ClientRequestStatus, enumName: 'ClientRequestStatus' })
  @IsOptional()
  @IsEnum(ClientRequestStatus)
  status?: ClientRequestStatus;

  @ApiPropertyOptional({ description: 'Recherche libre sur le nom, le prénom ou le téléphone.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  banqueId?: string;

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
