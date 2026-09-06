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
import {
  BddSegment,
  EnrollmentMethod,
  Phase2Status,
  Projet,
  ProspectStatut,
  ProspectType,
} from '@crm/database';

import { queryBoolean } from './query-boolean.js';
import { PROSPECT_ORIGINS } from '../prospect-origin.js';
import type { ProspectOrigin } from '../prospect-origin.js';

export enum ProspectSortField {
  CREATED_AT = 'createdAt',
  CLIENT_CREATED_AT = 'clientCreatedAt',
  NOM = 'nom',
  PRENOM = 'prenom',
  STATUT = 'statut',
  LAST_CALL_AT = 'lastCallAt',
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

  @ApiPropertyOptional({
    enum: Projet,
    enumName: 'Projet',
    description:
      'Le projet. ABSENT veut dire les deux : chaque écran de projet doit le poser, sinon CHUES et Grand Public se mélangent dans la même liste.',
  })
  @IsOptional()
  @IsEnum(Projet)
  projet?: Projet;

  @ApiPropertyOptional({
    enum: ProspectType,
    enumName: 'ProspectType',
    description: 'Grand Public : fonctionnaire, secteur privé, informel, diaspora.',
  })
  @IsOptional()
  @IsEnum(ProspectType)
  type?: ProspectType;

  @ApiPropertyOptional({ format: 'uuid', description: 'Grand Public : canal de provenance.' })
  @IsOptional()
  @IsUUID()
  canalProvenanceId?: string;

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
    description: 'Téléconseiller ayant consigné au moins une tentative sur la fiche.',
  })
  @IsOptional()
  @IsUUID()
  appelePar?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Téléconseiller du DERNIER appel porté par la fiche. À ne pas confondre avec `appelePar`, qui accepte n’importe quelle tentative de l’historique.',
  })
  @IsOptional()
  @IsUUID()
  lastCallById?: string;

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
    description:
      'Où en est la revue du closing. Les DEUX valeurs bornent aux demandes converties : ' +
      '`false` rend celles que personne n’a encore revues, `true` celles qui l’ont été.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  revue?: boolean;

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
