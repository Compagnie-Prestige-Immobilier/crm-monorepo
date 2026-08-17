import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { BddSegment, EnrollmentMethod, Phase2Status } from '@crm/database';

import { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';

export enum TimeGranularity {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class AnalyticsQueryDto extends ProspectFilterDto {}

export class TimeSeriesQueryDto extends ProspectFilterDto {
  @ApiPropertyOptional({
    enum: TimeGranularity,
    enumName: 'TimeGranularity',
    default: TimeGranularity.DAY,
  })
  @IsOptional()
  @IsEnum(TimeGranularity)
  granularity?: TimeGranularity;
}

export class TopQueryDto extends ProspectFilterDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AnalyticsTotalsDto {
  @ApiProperty({ type: Number }) prospects!: number;
  @ApiProperty({ type: Number }) representants!: number;
  @ApiProperty({ type: Number }) commerciauxActifs!: number;
  @ApiProperty({ type: Number }) departementsCouverts!: number;
  @ApiProperty({ type: Number }) nouveau!: number;
  @ApiProperty({ type: Number }) contacte!: number;
  @ApiProperty({ type: Number }) converti!: number;
  @ApiProperty({ type: Number }) perdu!: number;
  @ApiProperty({ type: Number, description: 'Prospects saisis sur les 7 derniers jours.' })
  prospects7Jours!: number;
  @ApiProperty({ type: Number, description: 'Prospects saisis sur les 30 derniers jours.' })
  prospects30Jours!: number;
}

export class TimeBucketDto {
  @ApiProperty({ type: String, format: 'date-time', description: 'Début de la période.' })
  bucket!: string;

  @ApiProperty({ type: Number }) prospects!: number;
  @ApiProperty({ type: Number }) representants!: number;
}

/** La clé d'énumération accompagne le libellé : le tableau de bord colore et ordonne sur la clé, jamais sur le texte. Les buckets vides sont rendus à zéro, pas omis. */
export class NamedCountDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) id!: string | null;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Number }) prospects!: number;
  @ApiProperty({ type: Number, description: 'Part du total filtré, en pourcentage.' })
  share!: number;
}

export class TopCommercialDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Number }) prospects!: number;
  @ApiProperty({ type: Number }) representants!: number;
  @ApiProperty({ type: Number }) share!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  derniereSaisie!: string | null;
}

export class TopRepresentantDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() label!: string;
  @ApiProperty() phoneE164!: string;
  @ApiProperty() departementName!: string;
  @ApiProperty() commercialName!: string;
  @ApiProperty({ type: Number }) prospects!: number;
}

export class AnalyticsSeriesDto {
  @ApiProperty({ type: () => [TimeBucketDto] }) buckets!: TimeBucketDto[];
}

export class NamedCountListDto {
  @ApiProperty({ type: () => [NamedCountDto] }) items!: NamedCountDto[];
  @ApiProperty({ type: Number }) total!: number;
}

export class TopCommercialListDto {
  @ApiProperty({ type: () => [TopCommercialDto] }) items!: TopCommercialDto[];
  @ApiProperty({ type: Number }) total!: number;
}

export class TopRepresentantListDto {
  @ApiProperty({ type: () => [TopRepresentantDto] }) items!: TopRepresentantDto[];
  @ApiProperty({ type: Number }) total!: number;
}

export class Phase2StatusCountDto {
  @ApiProperty({ enum: Phase2Status, enumName: 'Phase2Status' }) status!: Phase2Status;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Number }) prospects!: number;
  @ApiProperty({ type: Number, description: 'Part du total filtré, en pourcentage.' })
  share!: number;
}

export class EnrollmentMethodCountDto {
  @ApiProperty({ enum: EnrollmentMethod, enumName: 'EnrollmentMethod' })
  method!: EnrollmentMethod;

  @ApiProperty() label!: string;
  @ApiProperty({ type: Number }) prospects!: number;
  @ApiProperty({ type: Number, description: 'Part des prospects porteurs d’une méthode.' })
  share!: number;
}

export class SegmentCountDto {
  @ApiProperty({ enum: BddSegment, enumName: 'BddSegment' }) segment!: BddSegment;
  @ApiProperty({ description: 'Libellé partagé, issu de SEGMENT_LABELS.' }) label!: string;
  @ApiProperty({ type: Number }) prospects!: number;
  @ApiProperty({ type: Number }) share!: number;
  @ApiProperty({ type: Number, description: 'Prospects du segment avec une méthode obtenue.' })
  methodObtained!: number;
}

export class Phase2StatusListDto {
  @ApiProperty({ type: () => [Phase2StatusCountDto] }) items!: Phase2StatusCountDto[];
  @ApiProperty({ type: Number }) total!: number;
}

export class EnrollmentMethodListDto {
  @ApiProperty({ type: () => [EnrollmentMethodCountDto] }) items!: EnrollmentMethodCountDto[];
  @ApiProperty({ type: Number, description: 'Prospects porteurs d’une méthode.' })
  total!: number;
}

export class SegmentListDto {
  @ApiProperty({ type: () => [SegmentCountDto] }) items!: SegmentCountDto[];
  @ApiProperty({ type: Number }) total!: number;
}
