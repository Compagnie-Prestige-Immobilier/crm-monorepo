import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BddSegment, EnrollmentMethod, Phase2Status, ProspectStatut } from '@crm/database';

import { queryBoolean } from './query-boolean.js';
import { PROSPECT_ORIGINS } from '../prospect-origin.js';
import type { ProspectOrigin } from '../prospect-origin.js';

export enum ProspectSortField {
  CREATED_AT = 'createdAt',
  CLIENT_CREATED_AT = 'clientCreatedAt',
  NOM = 'nom',
  PRENOM = 'prenom',
  STATUT = 'statut',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ProspectFilterDto {
  @ApiPropertyOptional({
    description: 'Recherche libre sur le nom, le prénom ou le téléphone.',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  representantId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  banqueId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  syndicatId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departementId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Réservé à l’ADMIN : un COMMERCIAL reste borné à ses propres lignes.',
  })
  @IsOptional()
  @IsUUID()
  commercialId?: string;

  @ApiPropertyOptional({ enum: ProspectStatut, enumName: 'ProspectStatut' })
  @IsOptional()
  @IsEnum(ProspectStatut)
  statut?: ProspectStatut;

  @ApiPropertyOptional({
    enum: BddSegment,
    enumName: 'BddSegment',
    description:
      'Segment logique : BDD1 = CHUES/CBAO, BDD2 = CHUES/autre banque, BDD3 = autre syndicat/CBAO, BDD4 = autre syndicat/autre banque.',
  })
  @IsOptional()
  @IsEnum(BddSegment)
  segment?: BddSegment;

  @ApiPropertyOptional({
    enum: Phase2Status,
    enumName: 'Phase2Status',
    description: 'Avancement de la phase 2. Dimension indépendante de `statut`.',
  })
  @IsOptional()
  @IsEnum(Phase2Status)
  phase2Status?: Phase2Status;

  @ApiPropertyOptional({
    enum: EnrollmentMethod,
    enumName: 'EnrollmentMethod',
    description: 'Méthode d’enrôlement obtenue en phase 2.',
  })
  @IsOptional()
  @IsEnum(EnrollmentMethod)
  enrollmentMethod?: EnrollmentMethod;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Campagne d’appels : ne retient que les prospects portant une tâche de cette campagne.',
  })
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.',
  })
  @IsOptional()
  @IsUUID()
  enrollmentCapturedById?: string;

  @ApiPropertyOptional({
    type: String,
    enum: PROSPECT_ORIGINS,
    description:
      'Provenance de la fiche. Omis, le filtre ne distingue pas : les fiches de tournée terrain (provenance nulle) restent incluses.',
  })
  @IsOptional()
  @IsIn(PROSPECT_ORIGINS)
  origin?: ProspectOrigin;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.',
  })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.',
  })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Inclure les fiches supprimées logiquement. Réservé à l’ADMIN.',
    default: false,
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  includeDeleted?: boolean;
}

export class ProspectQueryDto extends ProspectFilterDto {
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

  @ApiPropertyOptional({ enum: ProspectSortField, enumName: 'ProspectSortField' })
  @IsOptional()
  @IsEnum(ProspectSortField)
  sortBy?: ProspectSortField;

  @ApiPropertyOptional({ enum: SortOrder, enumName: 'SortOrder' })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}

export class PageMetaDto {
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) pageSize!: number;
  @ApiProperty({ type: Number }) pageCount!: number;
}
