import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  EmployeurType,
  PrioriteTraitement,
  RepresentantRelation,
  StatutQualificationEffect,
} from '@crm/database';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { queryBoolean } from '../../common/dto/query-boolean.js';
import { CALL_OUTCOME_EFFECT_VALUES, type CallOutcomeEffect } from './call-outcome-rules.js';

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

/** Par ou un prospect Grand Public est arrive : TikTok, LinkedIn, salon, parrainage. */
export class CanalProvenanceDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'Clé stable, jamais réécrite : les fiches la désignent.' })
  code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Number }) position!: number;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class ProfessionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Boolean }) isTeaching!: boolean;
  @ApiProperty({ type: Number }) position!: number;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class CreateProfessionDto {
  @ApiProperty({ maxLength: 40 })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/u)
  @MaxLength(40)
  code!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  isTeaching?: boolean;

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 9999 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  position?: number;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProfessionDto extends PartialType(CreateProfessionDto) {}

export class EmployeurDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'Clé stable, jamais réécrite : les fiches la désignent.' })
  code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: EmployeurType, enumName: 'EmployeurType' }) type!: EmployeurType;
  @ApiProperty({ type: Number }) position!: number;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class CreateEmployeurDto {
  @ApiProperty({ maxLength: 60, pattern: '^[A-Z][A-Z0-9_]*$' })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/u)
  @MaxLength(60)
  code!: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  label!: string;

  @ApiProperty({ enum: EmployeurType, enumName: 'EmployeurType' })
  @IsEnum(EmployeurType)
  type!: EmployeurType;

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 9999 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  position?: number;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateEmployeurDto extends PartialType(CreateEmployeurDto) {}

/** Pays de résidence de la diaspora. Lecture seule : la liste ISO ne bouge pas. */
export class PaysDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'ISO 3166-1 alpha-2.' }) code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ description: 'Indicatif téléphonique sans le « + ».' }) indicatif!: string;
  @ApiProperty({ type: Number }) position!: number;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class IncomeBandDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Number, nullable: true }) minXof!: number | null;
  @ApiProperty({ type: Number, nullable: true }) maxXof!: number | null;
  @ApiProperty({ type: Number }) position!: number;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class CreateIncomeBandDto {
  @ApiProperty({ maxLength: 40 })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/u)
  @MaxLength(40)
  code!: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label!: string;

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minXof?: number;

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxXof?: number;

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 9999 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  position?: number;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateIncomeBandDto extends PartialType(CreateIncomeBandDto) {}

export class OfferDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: Number }) position!: number;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class CreateOfferDto {
  @ApiProperty({ maxLength: 40 })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/u)
  @MaxLength(40)
  code!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 9999 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  position?: number;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOfferDto extends PartialType(CreateOfferDto) {}

export class CreateCanalProvenanceDto {
  @ApiProperty({ maxLength: 40, description: 'Immuable une fois posé.' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label!: string;

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 9999 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  position?: number;
}

export class UpdateCanalProvenanceDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label?: string;

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 9999 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  position?: number;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Le retirer des listes, jamais le supprimer.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
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
  @ApiProperty({ type: () => [ProfessionDto] }) professions!: ProfessionDto[];
  @ApiProperty({ type: () => [IncomeBandDto] }) incomeBands!: IncomeBandDto[];
  @ApiProperty({ type: () => [OfferDto] }) offers!: OfferDto[];
  @ApiProperty({ type: () => [EmployeurDto] }) employeurs!: EmployeurDto[];
  @ApiProperty({ type: () => [PaysDto] }) pays!: PaysDto[];
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

export class CallOutcomeReasonDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty({
    description: 'Code stable, jamais modifiable : les tentatives déjà remontées le référencent.',
  })
  code!: string;

  @ApiProperty() label!: string;

  @ApiProperty({ enum: CALL_OUTCOME_EFFECT_VALUES, enumName: 'CallOutcomeEffect' })
  effect!: CallOutcomeEffect;

  @ApiProperty({ type: Boolean }) requiresComment!: boolean;
  @ApiProperty({ type: Boolean }) requiresCallback!: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'Compte pour un appel joignable dans le taux de joignabilité.',
  })
  countsAsReached!: boolean;

  @ApiProperty({ type: Boolean }) isActive!: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'Motif système : porte une règle compilée, ni désactivable ni reconfigurable.',
  })
  isSystem!: boolean;

  @ApiProperty({ type: Number }) sortOrder!: number;
  @ApiProperty({ type: String, nullable: true }) color!: string | null;

  @ApiProperty({
    type: Number,
    description:
      'Version de charge utile minimale du client. Un téléphone plus ancien ne reçoit pas ce motif : il ne saurait pas l’émettre.',
  })
  minPayloadVersion!: number;

  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class CallOutcomeReasonListDto {
  @ApiProperty({ type: () => [CallOutcomeReasonDto] }) items!: CallOutcomeReasonDto[];
}

export class FieldVocabularyQueryDto {
  @ApiProperty({
    type: Number,
    minimum: 1,
    maximum: 1_000,
    description: 'Version de charge utile du client appelant. Obligatoire.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000)
  payloadVersion!: number;
}

export class CreateCallOutcomeReasonDto {
  @ApiProperty({ maxLength: 40, pattern: '^[A-Z][A-Z0-9_]*$' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Z][A-Z0-9_]*$/u, {
    message: 'code doit être en majuscules, chiffres et tirets bas.',
  })
  code!: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label!: string;

  @ApiProperty({ enum: CALL_OUTCOME_EFFECT_VALUES, enumName: 'CallOutcomeEffect' })
  @IsIn(CALL_OUTCOME_EFFECT_VALUES)
  effect!: CallOutcomeEffect;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  requiresComment?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Réservé à l’effet SCHEDULE_CALLBACK.',
  })
  @IsOptional()
  @IsBoolean()
  requiresCallback?: boolean;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  countsAsReached?: boolean;

  @ApiPropertyOptional({ type: String, maxLength: 40, description: 'Rôle du design system.' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  color?: string;

  @ApiPropertyOptional({ type: Number, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCallOutcomeReasonDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label?: string;

  @ApiPropertyOptional({ type: String, maxLength: 40 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  color?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  requiresComment?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  requiresCallback?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  countsAsReached?: boolean;
}

export class SetCallOutcomeReasonActiveDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  isActive!: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Statuts de qualification du représentant
// ─────────────────────────────────────────────────────────────────────────────

export class StatutQualificationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ maxLength: 64 }) code!: string;
  @ApiProperty({ maxLength: 120 }) label!: string;
  @ApiProperty({ enum: StatutQualificationEffect, enumName: 'StatutQualificationEffect' })
  effect!: StatutQualificationEffect;
  @ApiProperty({ description: 'La date du rappel est exigée par ce statut.' })
  requiresCallback!: boolean;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Délai, en minutes, du réessai que l’application propose d’elle-même. Nul : aucun réessai.',
  })
  retryAfterMinutes!: number | null;
  @ApiProperty({
    enum: PrioriteTraitement,
    enumName: 'PrioriteTraitement',
    description: 'Ordre de reprise : un « Très intéressé » se rappelle avant un « Non éligible ».',
  })
  priorite!: PrioriteTraitement;
  @ApiProperty({
    enum: RepresentantRelation,
    enumName: 'RepresentantRelation',
    nullable: true,
    description: 'La relation posée sur la fiche. Nulle quand le statut ne tranche rien.',
  })
  relationStatus!: RepresentantRelation | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ description: 'Le script s’appuie dessus : sa règle ne se reconfigure pas.' })
  isSystem!: boolean;
  @ApiProperty({ description: 'Version de charge utile minimale sachant émettre ce code.' })
  minPayloadVersion!: number;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class StatutQualificationListDto {
  @ApiProperty({ type: () => [StatutQualificationDto] }) items!: StatutQualificationDto[];
}

export class StatutQualificationFieldQueryDto {
  @ApiProperty({
    type: Number,
    description:
      'Version de charge utile de l’appelant. Un statut qu’il ne saurait pas émettre ne lui est jamais proposé : sa remontée finirait en échec définitif, hors ligne.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  payloadVersion!: number;
}

export class CreateStatutQualificationDto {
  @ApiProperty({ maxLength: 64, description: 'Immuable : l’historique le référence.' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[A-Za-z][A-Za-z0-9_]*$/u, {
    message: 'Le code ne contient que des lettres, des chiffres et des soulignés.',
  })
  code!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @ApiProperty({ enum: StatutQualificationEffect, enumName: 'StatutQualificationEffect' })
  @IsEnum(StatutQualificationEffect)
  effect!: StatutQualificationEffect;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresCallback?: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 5, maximum: 10080 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(10080)
  retryAfterMinutes?: number | null;

  @ApiPropertyOptional({
    enum: PrioriteTraitement,
    enumName: 'PrioriteTraitement',
    default: PrioriteTraitement.NORMALE,
  })
  @IsOptional()
  @IsEnum(PrioriteTraitement)
  priorite?: PrioriteTraitement;

  @ApiPropertyOptional({
    enum: RepresentantRelation,
    enumName: 'RepresentantRelation',
    nullable: true,
    description: 'Relation posée sur la fiche quand le client n’en envoie pas.',
  })
  @IsOptional()
  @IsEnum(RepresentantRelation)
  relationStatus?: RepresentantRelation | null;
}

export class UpdateStatutQualificationDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresCallback?: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 5,
    maximum: 10080,
    description: 'Nul retire le réessai proposé.',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(10080)
  retryAfterMinutes?: number | null;

  @ApiPropertyOptional({ enum: PrioriteTraitement, enumName: 'PrioriteTraitement' })
  @IsOptional()
  @IsEnum(PrioriteTraitement)
  priorite?: PrioriteTraitement;

  @ApiPropertyOptional({
    enum: RepresentantRelation,
    enumName: 'RepresentantRelation',
    nullable: true,
    description: 'Nul retire la relation posée : le statut cesse alors de trancher.',
  })
  @IsOptional()
  @IsEnum(RepresentantRelation)
  relationStatus?: RepresentantRelation | null;
}

export class SetStatutQualificationActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}
