import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BddSegment, EnrollmentMethod, Phase2Status, ProspectStatut } from '@crm/database';

/**
 * Filtre commun à la liste des prospects, aux endpoints analytiques et à
 * l'export Excel. Un DTO unique garantit que le tableau affiché, les
 * graphiques du tableau de bord et le fichier exporté décrivent bien le même
 * sous-ensemble : trois définitions séparées finiraient par diverger, et
 * l'utilisateur exporterait autre chose que ce qu'il voit.
 */

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

  /**
   * Segment BDD1–BDD4. Le filtre est traduit par `segmentWhere` (@crm/database),
   * seule définition autorisée du croisement syndicat × banque : écrire ici une
   * clause `syndicatId`/`banqueId` « équivalente » ferait diverger l'onglet
   * « BDD1 » du classeur et le graphique « BDD1 » du tableau de bord.
   */
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

  /**
   * Le commercial qui a OBTENU la méthode, distinct de `commercialId` qui
   * désigne l'auteur de la saisie de phase 1. Confondre les deux attribuerait
   * le travail d'appel de la phase 2 à celui qui a rempli la fiche sur le
   * terrain des mois plus tôt.
   */
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Commercial ayant obtenu la méthode d’enrôlement. À ne pas confondre avec `commercialId`, auteur de la saisie de phase 1.',
  })
  @IsOptional()
  @IsUUID()
  enrollmentCapturedById?: string;

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
  @Type(() => Boolean)
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
