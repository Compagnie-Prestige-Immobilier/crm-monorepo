import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { CallOutcome, EnrollmentMethod, LotExportCible, Projet, RepCallOutcome } from '@crm/database';
import { ProspectFilterDto, PageMetaDto } from '../../common/dto/prospect-filter.dto.js';
import { RepresentantExportQueryDto } from '../representants/dto.js';

export class CreateLotExportDto {
  @ApiProperty({ maxLength: 120 }) @IsString() @MinLength(3) @MaxLength(120) name!: string;
  @ApiProperty({ enum: LotExportCible, enumName: 'LotExportCible' }) @IsEnum(LotExportCible) cible!: LotExportCible;
  @ApiPropertyOptional({ type: () => RepresentantExportQueryDto }) @IsOptional() @ValidateNested() @Type(() => RepresentantExportQueryDto) representants?: RepresentantExportQueryDto;
  @ApiPropertyOptional({ type: () => ProspectFilterDto }) @IsOptional() @ValidateNested() @Type(() => ProspectFilterDto) prospects?: ProspectFilterDto;
}

export class LotExportQueryDto {
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @MaxLength(120) search?: string;
  @ApiPropertyOptional({ enum: LotExportCible, enumName: 'LotExportCible' }) @IsOptional() @IsEnum(LotExportCible) cible?: LotExportCible;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() createdById?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsISO8601() dateFrom?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsISO8601() dateTo?: string;
  @ApiPropertyOptional({ minimum: 1, default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 25 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
}

export class LotExportAttemptDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() phoneE164!: string;
  @ApiProperty() shortCode!: string;
  @ApiProperty({ enum: [...Object.values(CallOutcome), ...Object.values(RepCallOutcome)] }) outcome!: string;
  @ApiProperty({ enum: EnrollmentMethod, nullable: true }) method!: EnrollmentMethod | null;
  @ApiProperty({ nullable: true }) comment!: string | null;
  @ApiProperty() performedByName!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true }) email!: string | null;
  @ApiProperty({ nullable: true }) fonctionnaire!: boolean | null;
  @ApiProperty({ nullable: true }) engagementEnCours!: boolean | null;
  @ApiProperty({ nullable: true }) dureeEtablissementMois!: number | null;
  @ApiProperty({ nullable: true }) rendezVousAt!: string | null;
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

export class LotExportListDto { @ApiProperty({ type: () => [LotExportSummaryDto] }) items!: LotExportSummaryDto[]; @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto; }
export class LotExportDetailDto extends LotExportSummaryDto { @ApiProperty({ type: () => [LotExportAttemptDto] }) recentAttempts!: LotExportAttemptDto[]; @ApiProperty({ type: Object }) callsByTeleconseiller!: Record<string, number>; }
export class LotExportPreviewDto { @ApiProperty() eligible!: number; @ApiProperty() scopeLabel!: string; }
