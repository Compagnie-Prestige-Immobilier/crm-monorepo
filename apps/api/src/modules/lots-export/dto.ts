import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
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

/** L'objectif quotidien d'UN teleconseiller, qui prime sur la capacite du role. */
export class LotExportObjectifDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() teleconseillerId!: string;
  @ApiProperty({ type: Number, minimum: 1, maximum: 500 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  fichesParJour!: number;
}

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
  /**
   * EB-17 : l'objectif de chacun. Ce qui n'y figure pas retombe sur
   * `fichesParJour` pondéré par le rôle.
   */
  @ApiPropertyOptional({ type: () => [LotExportObjectifDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LotExportObjectifDto)
  objectifs?: LotExportObjectifDto[];
}

/**
 * Les critères d'un lot de prospects, projet EXIGÉ.
 *
 * `OmitType` plutôt qu'une redéclaration : l'`@IsOptional()` du filtre de liste
 * est hérité par class-validator, et le champ resterait facultatif.
 */
export class LotExportProspectFilterDto extends OmitType(ProspectFilterDto, ['projet'] as const) {
  @ApiProperty({
    enum: Projet,
    enumName: 'Projet',
    description: 'Projet du lot. Il est porté par la campagne et ne se devine pas après coup.',
  })
  @IsEnum(Projet)
  projet!: Projet;
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
  @ApiPropertyOptional({ type: () => LotExportProspectFilterDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LotExportProspectFilterDto)
  prospects?: LotExportProspectFilterDto;
  @ApiProperty({ type: () => LotExportDistributionInputDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LotExportDistributionInputDto)
  distribution!: LotExportDistributionInputDto;
}

/** EB-14 et EB-17 : le nom et les objectifs se règlent en cours de campagne. */
export class UpdateLotExportDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;
  @ApiPropertyOptional({ type: () => [LotExportObjectifDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LotExportObjectifDto)
  objectifs?: LotExportObjectifDto[];
}

/** EB-16 : les fiches désignées passent à un autre téléconseiller. */
export class ReaffecterLotExportDto {
  @ApiProperty({ type: [Number], minItems: 1, maxItems: 1000 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @Type(() => Number)
  @IsInt({ each: true })
  positions!: number[];
  @ApiProperty({ format: 'uuid' }) @IsUUID() versTeleconseillerId!: string;
}

/** EB-16 : le retiré rend ses fiches non traitées, redistribuées au reste de l'équipe. */
export class RetirerTeleconseillerDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() teleconseillerId!: string;
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

/**
 * EB-18 : où en est une fiche de la campagne.
 *
 * `A_RAPPELER` prime sur `TRAITEE` : une fiche appelée qui attend un rappel
 * n'est pas finie, et c'est ce qui reste à faire qui intéresse le superviseur.
 */
export enum LotExportFicheEtat {
  NON_TRAITEE = 'NON_TRAITEE',
  TRAITEE = 'TRAITEE',
  A_RAPPELER = 'A_RAPPELER',
}

export class LotExportFichesQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() teleconseillerId?: string;
  @ApiPropertyOptional({ enum: LotExportFicheEtat, enumName: 'LotExportFicheEtat' })
  @IsOptional()
  @IsEnum(LotExportFicheEtat)
  etat?: LotExportFicheEtat;
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

export class LotExportFicheDto {
  @ApiProperty() position!: number;
  @ApiProperty() jour!: number;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) ficheId!: string | null;
  @ApiProperty() fullName!: string;
  @ApiProperty() phoneE164!: string;
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  teleconseillerId!: string | null;
  @ApiProperty() teleconseillerName!: string;
  @ApiProperty({ enum: LotExportFicheEtat, enumName: 'LotExportFicheEtat' })
  etat!: LotExportFicheEtat;
  @ApiProperty({ type: String, nullable: true }) statutLabel!: string | null;
}

export class LotExportFichesDto {
  @ApiProperty({ type: () => [LotExportFicheDto] }) items!: LotExportFicheDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

/** EB-16 : qui a déplacé combien de fiches, de qui vers qui. */
export class LotExportReaffectationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, nullable: true }) fromName!: string | null;
  @ApiProperty() toName!: string;
  @ApiProperty() fiches!: number;
  @ApiProperty() performedByName!: string;
  @ApiProperty() createdAt!: string;
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
  @ApiProperty({ enum: Projet, enumName: 'Projet' }) projet!: Projet;
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
  /** EB-17 : les fiches à traiter par jour, dénominateur du taux de contact. */
  @ApiProperty() objectif!: number;
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
  @ApiProperty({ type: () => [LotExportReaffectationDto] })
  reaffectations!: LotExportReaffectationDto[];
}
/** Le périmètre d'appel de l'appelant, tous lots et tous jours confondus. */
export class MesAttributionsDto {
  @ApiProperty({ type: [String], format: 'uuid' }) representantIds!: string[];
  @ApiProperty({ type: [String], format: 'uuid' }) prospectIds!: string[];
  @ApiProperty({
    type: Boolean,
    description: 'Vrai pour l’encadrement : aucun filtre ne s’applique.',
  })
  tout!: boolean;
}
export class LotExportPreviewDto {
  @ApiProperty() eligible!: number;
  @ApiProperty() scopeLabel!: string;
  /** Fiches que la répartition demandée peut absorber : téléconseillers × fiches par jour × jours. */
  @ApiProperty() places!: number;
  @ApiProperty() retenues!: number;
  @ApiProperty() parTeleconseiller!: number;
}
