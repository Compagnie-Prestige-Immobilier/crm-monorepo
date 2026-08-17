import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { BddSegment, ChangeSource } from '@crm/database';

import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';

export class SegmentConversionsQueryDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne basse sur la date de bascule, incluse. Une date nue vaut minuit à Dakar.',
  })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne haute sur la date de bascule, incluse. Une date nue vaut 23:59:59 à Dakar.',
  })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({
    enum: BddSegment,
    enumName: 'BddSegment',
    description: 'Segment de DÉPART. « Combien de BDD3 avons-nous fait basculer. »',
  })
  @IsOptional()
  @IsEnum(BddSegment)
  fromSegment?: BddSegment;

  @ApiPropertyOptional({
    enum: BddSegment,
    enumName: 'BddSegment',
    description: 'Segment d’ARRIVÉE. « Combien de conversions vers BDD1. »',
  })
  @IsOptional()
  @IsEnum(BddSegment)
  toSegment?: BddSegment;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Auteur de la bascule. Réservé à l’ADMIN : un COMMERCIAL ne voit que les siennes.',
  })
  @IsOptional()
  @IsUUID()
  changedById?: string;

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

export class SegmentConversionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) prospectId!: string;
  @ApiProperty({ description: 'Prénom et nom de la fiche convertie, au moment de la lecture.' })
  prospectName!: string;

  @ApiProperty({ enum: BddSegment, enumName: 'BddSegment' }) fromSegment!: BddSegment;
  @ApiProperty({ enum: BddSegment, enumName: 'BddSegment' }) toSegment!: BddSegment;

  @ApiProperty({ type: String, nullable: true }) reason!: string | null;

  @ApiProperty({ format: 'uuid' }) changedById!: string;
  @ApiProperty() changedByName!: string;

  @ApiProperty({ enum: ChangeSource, enumName: 'ChangeSource' }) source!: ChangeSource;
  @ApiProperty({ type: String, format: 'date-time' }) changedAt!: string;
}

export class SegmentConversionOriginDto {
  @ApiProperty({ enum: BddSegment, enumName: 'BddSegment' }) segment!: BddSegment;
  @ApiProperty({ type: Number }) conversions!: number;
}

export class SegmentConversionAuthorDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: Number }) conversions!: number;
}

/** Les deux décomptes portent sur TOUTE la période filtrée, jamais sur la page affichée. */
export class SegmentConversionListDto {
  @ApiProperty({
    type: () => [SegmentConversionDto],
    description: 'De la plus récente à la plus ancienne.',
  })
  items!: SegmentConversionDto[];

  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;

  @ApiProperty({ type: () => [SegmentConversionOriginDto] })
  byOriginSegment!: SegmentConversionOriginDto[];

  @ApiProperty({ type: () => [SegmentConversionAuthorDto] })
  byAuthor!: SegmentConversionAuthorDto[];
}
