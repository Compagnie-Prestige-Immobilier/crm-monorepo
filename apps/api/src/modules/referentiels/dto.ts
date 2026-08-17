import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { queryBoolean } from '../../common/dto/query-boolean.js';

export class RegionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class DepartementDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ format: 'uuid' }) regionId!: string;
  @ApiProperty() regionName!: string;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class IefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ format: 'uuid' }) departementId!: string;
  @ApiProperty() departementName!: string;
  @ApiProperty() regionName!: string;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class BanqueDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() shortName!: string;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: Number }) sortOrder!: number;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class SyndicatDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sigle!: string;
  @ApiProperty({ type: String, nullable: true }) secteur!: string | null;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: Number }) sortOrder!: number;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class RegionWithDepartementsDto extends RegionDto {
  @ApiProperty({ type: () => [DepartementDto] })
  departements!: DepartementDto[];
}

export class ReferentielsBundleDto {
  @ApiProperty({ type: () => [BanqueDto] }) banques!: BanqueDto[];
  @ApiProperty({ type: () => [SyndicatDto] }) syndicats!: SyndicatDto[];
  @ApiProperty({ type: () => [DepartementDto] }) departements!: DepartementDto[];
  @ApiProperty({ type: () => [RegionDto] }) regions!: RegionDto[];
}

export class ReferentielQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: 'Ne renvoyer que les entrées actives.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  activeOnly?: boolean;
}

export class CreateBanqueDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ maxLength: 32 })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  shortName!: string;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: Number, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateBanqueDto extends PartialType(CreateBanqueDto) {}

export class CreateSyndicatDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ maxLength: 32 })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  sigle!: string;

  @ApiPropertyOptional({ type: String, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  secteur?: string;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: Number, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSyndicatDto extends PartialType(CreateSyndicatDto) {}

export class CreateDepartementDto {
  @ApiProperty({ maxLength: 16, description: 'Code administratif, unique.' })
  @IsString()
  @MinLength(2)
  @MaxLength(16)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code doit être en majuscules, chiffres, tiret ou tiret bas',
  })
  code!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  regionId!: string;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDepartementDto extends PartialType(CreateDepartementDto) {}
