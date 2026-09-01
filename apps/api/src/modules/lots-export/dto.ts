import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CallOutcome,
  EnrollmentMethod,
  LotExportCible,
  Projet,
  RepCallOutcome,
} from '@crm/database';
import { ProspectFilterDto, PageMetaDto } from '../../common/dto/prospect-filter.dto.js';
import { RepresentantExportQueryDto } from '../representants/dto.js';

/** La base tire des `uuid(7)` : contraindre la version 4 refuserait tout compte. */
export class LotExportDistributionInputDto {
  @ApiProperty({ type: [String], format: 'uuid', minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  teleconseillerIds!: string[];
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 500, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  fichesParJour: number = 50;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 10, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  jours: number = 1;
}

export class CreateLotExportDto {
  @ApiProperty({ maxLength: 120 }) @IsString() @MinLength(3) @MaxLength(120) name!: string;
  @ApiProperty({ enum: LotExportCible, enumName: 'LotExportCible' })
  @IsEnum(LotExportCible)
  cible!: LotExportCible;
  @ApiPropertyOptional({ type: () => RepresentantExportQueryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RepresentantExportQueryDto)
  representants?: RepresentantExportQueryDto;
  @ApiPropertyOptional({ type: () => ProspectFilterDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProspectFilterDto)
  prospects?: ProspectFilterDto;
  @ApiProperty({ type: () => LotExportDistributionInputDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LotExportDistributionInputDto)
  distribution!: LotExportDistributionInputDto;
}

export class LotExportProgrammeQueryDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() teleconseillerId!: string;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 10, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  jour: number = 1;
}

export class LotExportQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
  @ApiPropertyOptional({ enum: LotExportCible, enumName: 'LotExportCible' })
  @IsOptional()
  @IsEnum(LotExportCible)
  cible?: LotExportCible;
  @ApiPropertyOptional({ enum: Projet, enumName: 'Projet' })
  @IsOptional()
  @IsEnum(Projet)
  projet?: Projet;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() createdById?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsISO8601() dateFrom?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsISO8601() dateTo?: string;
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

export class LotExportAttemptDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() phoneE164!: string;
  @ApiProperty() shortCode!: string;
  @ApiProperty({ enum: [...Object.values(CallOutcome), ...Object.values(RepCallOutcome)] })
  outcome!: string;
  @ApiProperty({ enum: EnrollmentMethod, nullable: true }) method!: EnrollmentMethod | null;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty() performedByName!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true }) email!: string | null;
  @ApiProperty({ nullable: true }) fonctionnaire!: boolean | null;
  @ApiProperty({ nullable: true }) engagementEnCours!: boolean | null;
  @ApiProperty({ nullable: true }) dureeEtablissementMois!: number | null;
  @ApiProperty({ type: String, nullable: true }) rendezVousAt!: string | null;
}

export class LotExportSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: LotExportCible, enumName: 'LotExportCible' }) cible!: LotExportCible;
  @ApiProperty({ enum: Projet, enumName: 'Projet', nullable: true }) projet!: Projet | null;
  @ApiProperty() scopeLabel!: string;
  @ApiProperty() itemCount!: number;
  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty() createdByName!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() callsSince!: number;
  @ApiProperty() fichesAppelees!: number;
}

export class LotExportListDto {
  @ApiProperty({ type: () => [LotExportSummaryDto] }) items!: LotExportSummaryDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}
export class LotExportDistributionDto {
  @ApiProperty() fichesParJour!: number;
  @ApiProperty() jours!: number;
}
export class LotExportRepartitionJourDto {
  @ApiProperty() jour!: number;
  @ApiProperty() fiches!: number;
}
export class LotExportRepartitionDto {
  @ApiProperty({ format: 'uuid' }) teleconseillerId!: string;
  @ApiProperty() teleconseillerName!: string;
  @ApiProperty({ type: () => [LotExportRepartitionJourDto] }) jours!: LotExportRepartitionJourDto[];
}
export class LotExportPerformanceDto {
  @ApiProperty({ format: 'uuid' }) teleconseillerId!: string;
  @ApiProperty() teleconseillerName!: string;
  @ApiProperty() assigned!: number;
  @ApiProperty() treated!: number;
  @ApiProperty() completionRate!: number;
  @ApiProperty() assignedCalls!: number;
  @ApiProperty() outsideAssignmentCalls!: number;
}
export class LotExportDetailDto extends LotExportSummaryDto {
  @ApiProperty({ type: () => [LotExportAttemptDto] }) recentAttempts!: LotExportAttemptDto[];
  @ApiProperty({ type: Object }) callsByTeleconseiller!: Record<string, number>;
  @ApiProperty({ type: () => LotExportDistributionDto }) distribution!: LotExportDistributionDto;
  @ApiProperty({ type: () => [LotExportRepartitionDto] }) repartition!: LotExportRepartitionDto[];
  @ApiProperty({ type: () => [LotExportPerformanceDto] })
  performance!: LotExportPerformanceDto[];
}
export class LotExportPreviewDto {
  @ApiProperty() eligible!: number;
  @ApiProperty() scopeLabel!: string;
  /** Fiches que la répartition demandée peut absorber : téléconseillers × fiches par jour × jours. */
  @ApiProperty() places!: number;
  @ApiProperty() retenues!: number;
  @ApiProperty() parTeleconseiller!: number;
}
