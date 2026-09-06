import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Projet } from '@crm/database';

import { CHAMPS_LIBRES_MAX, TYPES_CHAMP_LIBRE, type TypeChampLibre } from './catalogue.js';

export const LIBELLE_MAX_LENGTH = 80;
export const OPTION_MAX_LENGTH = 80;
export const OPTIONS_MAX = 30;

export class ReglageChampDto {
  @ApiProperty({ description: 'Clé du champ dans le catalogue de la conversion.' })
  champ!: string;

  @ApiProperty() libelle!: string;
  @ApiProperty({ type: Boolean }) visible!: boolean;
  @ApiProperty({ type: Boolean }) obligatoire!: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'Champ exigé par les indicateurs et le closing : il ne peut pas être masqué.',
  })
  impose!: boolean;
}

export class ChampLibreDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() libelle!: string;
  @ApiProperty({ enum: TYPES_CHAMP_LIBRE }) type!: TypeChampLibre;

  @ApiProperty({ type: [String], description: 'Valeurs proposées, pour le type LISTE seulement.' })
  options!: string[];

  @ApiProperty({ type: Boolean }) obligatoire!: boolean;
}

export class ReglagesConversionDto {
  @ApiProperty({ enum: Projet, enumName: 'Projet' }) projet!: Projet;

  @ApiProperty({
    type: () => [ReglageChampDto],
    description: 'Dans l’ordre d’affichage. Un champ masqué n’est ni rendu ni exigé.',
  })
  champs!: ReglageChampDto[];

  @ApiProperty({ type: () => [ChampLibreDto] }) libres!: ChampLibreDto[];

  @ApiProperty({ type: String, format: 'date-time', nullable: true }) updatedAt!: string | null;
}

export class ReglageChampInputDto {
  @ApiProperty()
  @IsString()
  @MaxLength(60)
  champ!: string;

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  visible!: boolean;

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  obligatoire!: boolean;
}

export class ChampLibreInputDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Absent : le champ vient d’être ajouté.' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ maxLength: LIBELLE_MAX_LENGTH })
  @IsString()
  @MaxLength(LIBELLE_MAX_LENGTH)
  libelle!: string;

  @ApiProperty({ enum: TYPES_CHAMP_LIBRE })
  @IsIn(TYPES_CHAMP_LIBRE)
  type!: TypeChampLibre;

  @ApiPropertyOptional({ type: [String], maxItems: OPTIONS_MAX })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(OPTIONS_MAX)
  @IsString({ each: true })
  @MaxLength(OPTION_MAX_LENGTH, { each: true })
  options?: string[];

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  obligatoire!: boolean;
}

export class UpdateReglagesConversionDto {
  @ApiProperty({
    type: () => [ReglageChampInputDto],
    description: 'La liste ENTIÈRE, dans l’ordre d’affichage voulu.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReglageChampInputDto)
  champs!: ReglageChampInputDto[];

  @ApiProperty({ type: () => [ChampLibreInputDto], maxItems: CHAMPS_LIBRES_MAX })
  @IsArray()
  @ArrayMaxSize(CHAMPS_LIBRES_MAX)
  @ValidateNested({ each: true })
  @Type(() => ChampLibreInputDto)
  libres!: ChampLibreInputDto[];
}
