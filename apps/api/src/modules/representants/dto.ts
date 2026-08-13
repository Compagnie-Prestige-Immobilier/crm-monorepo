import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
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

import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';

export class CreateRepresentantDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Identifiant UUID v7 généré par le client. Fourni par le mobile pour que les prospects saisis hors ligne puissent le référencer avant toute synchronisation.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({
    maxLength: 40,
    description: 'Téléphone en saisie libre. Normalisé en E.164 par le serveur.',
    example: '77 123 45 67',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  departementId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'IEF de rattachement. FACULTATIVE : les fiches saisies avant l’arrivée de ' +
      'ce référentiel n’en portent pas, et la rendre obligatoire les invaliderait ' +
      'rétroactivement. Le département reste obligatoire — il se déduit de l’IEF, ' +
      'jamais l’inverse.',
  })
  @IsOptional()
  @IsUUID()
  iefId?: string;

  @ApiPropertyOptional({ type: String, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Horodatage de la saisie sur le terrain. Défaut : maintenant. Distinct de createdAt, qui est l’arrivée en base.',
  })
  @IsOptional()
  @IsISO8601()
  clientCreatedAt?: string;
}

export class UpdateRepresentantDto extends PartialType(CreateRepresentantDto) {}

export class RepresentantDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ description: 'Téléphone normalisé E.164.' }) phoneE164!: string;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ type: Number, description: 'Révision serveur, incrémentée à chaque écriture.' })
  rev!: number;
  @ApiProperty({ format: 'uuid' }) departementId!: string;
  @ApiProperty() departementName!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) iefId!: string | null;
  @ApiProperty({ type: String, nullable: true }) iefName!: string | null;
  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty() createdByName!: string;
  @ApiProperty({ type: String, format: 'date-time' }) clientCreatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: Number }) prospectCount!: number;
}

export class RepresentantListDto {
  @ApiProperty({ type: () => [RepresentantDto] }) items!: RepresentantDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export class RepresentantQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departementId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtre par IEF.' })
  @IsOptional()
  @IsUUID()
  iefId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Réservé à l’ADMIN.' })
  @IsOptional()
  @IsUUID()
  commercialId?: string;

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

export class RepresentantLookupQueryDto {
  @ApiProperty({
    description: 'Téléphone en saisie libre ; normalisé avant recherche.',
    example: '77 123 45 67',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone!: string;
}

/**
 * Réponse du lookup par téléphone.
 *
 * `found: false` plutôt qu'un 404 : « ce numéro est libre » est une réponse
 * métier normale sur le chemin de saisie, pas une erreur. Un 404 obligerait
 * l'app mobile à traiter comme exception le cas le plus fréquent.
 */
export class RepresentantLookupDto {
  @ApiProperty({ type: Boolean }) found!: boolean;

  @ApiProperty({ description: 'Le numéro tel que normalisé par le serveur.' })
  phoneE164!: string;

  @ApiProperty({ type: () => RepresentantDto, nullable: true })
  representant!: RepresentantDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Nom du commercial propriétaire de la fiche, pour que le mobile puisse dire à qui s’adresser.',
  })
  ownedByCommercialName!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  ownedByCommercialId!: string | null;
}

export class DeleteQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Supprimer aussi les prospects rattachés. Sinon la suppression est refusée.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  cascade?: boolean;
}
