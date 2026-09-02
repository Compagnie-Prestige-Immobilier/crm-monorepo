import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsBoolean,
  IsEnum,
  IsISO8601,
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
import { BankStageType, Projet } from '@crm/database';

import { PageMetaDto, SortOrder } from '../../common/dto/prospect-filter.dto.js';
import { queryBoolean } from '../../common/dto/query-boolean.js';
import { MONEY_PATTERN } from './money.js';

const MONEY_DESCRIPTION =
  'Montant en francs CFA, entier, exposé en chaîne. XOF n’a pas de décimales et un nombre JSON perdrait de la précision au-delà de 2^53.';

export class BankCaseStageDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'Code stable, jamais modifiable après création.' }) code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Number }) position!: number;
  @ApiProperty({ description: 'Rôle du design system (info, warning, success…), pas un hex.' })
  color!: string;
  @ApiProperty({ enum: BankStageType, enumName: 'BankStageType' }) type!: BankStageType;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: Boolean }) isInitial!: boolean;
  @ApiProperty({
    type: Boolean,
    description: 'Étape système : règles financières fixes, ni désactivable ni renommable en code.',
  })
  isSystem!: boolean;
}

export class BankCaseStageListDto {
  @ApiProperty({ type: () => [BankCaseStageDto] }) items!: BankCaseStageDto[];
}

export class BankRejectionReasonDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Number }) sortOrder!: number;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
}

export class BankRejectionReasonListDto {
  @ApiProperty({ type: () => [BankRejectionReasonDto] }) items!: BankRejectionReasonDto[];
}

export class BankCaseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty({ description: 'Référence telle que saisie par l’agent.' }) reference!: string;
  @ApiProperty({ description: 'Forme normalisée portant l’unicité globale.' })
  referenceKey!: string;

  @ApiProperty({ format: 'uuid' }) prospectId!: string;

  @ApiProperty({
    description:
      'Nom COPIÉ à la création. Immuable : corriger le prospect ne réécrit pas ce qui a été transmis à la banque.',
  })
  customerName!: string;

  @ApiProperty({ description: 'Téléphone E.164 copié à la création. Immuable.' })
  customerPhoneE164!: string;

  @ApiProperty({ format: 'uuid' }) processingBankId!: string;
  @ApiProperty() processingBankName!: string;

  @ApiProperty({ type: () => BankCaseStageDto }) currentStage!: BankCaseStageDto;

  @ApiProperty({ type: String, nullable: true, description: MONEY_DESCRIPTION })
  amountXof!: string | null;

  @ApiProperty({ type: () => BankRejectionReasonDto, nullable: true })
  rejectionReason!: BankRejectionReasonDto | null;

  @ApiProperty({ type: String, nullable: true }) rejectionDetail!: string | null;

  @ApiProperty({
    type: Number,
    description: 'Révision serveur. À renvoyer en `expectedRev` sur toute mutation.',
  })
  rev!: number;

  @ApiProperty({
    type: Boolean,
    description: 'Dossier encaissé ou rejeté : verrouillé pour un agent BANQUE_FINANCE.',
  })
  isTerminal!: boolean;

  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty() createdByName!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) updatedById!: string | null;
  @ApiProperty({ type: String, nullable: true }) updatedByName!: string | null;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class BankCaseTransitionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) caseId!: string;

  @ApiProperty({
    type: () => BankCaseStageDto,
    nullable: true,
    description: 'Nul pour la transition de création.',
  })
  fromStage!: BankCaseStageDto | null;

  @ApiProperty({ type: () => BankCaseStageDto }) toStage!: BankCaseStageDto;

  @ApiProperty({ format: 'uuid' }) performedById!: string;
  @ApiProperty() performedByName!: string;

  @ApiProperty({ type: String, nullable: true, description: MONEY_DESCRIPTION })
  amountXof!: string | null;

  @ApiProperty({ type: () => BankRejectionReasonDto, nullable: true })
  rejectionReason!: BankRejectionReasonDto | null;

  @ApiProperty({ type: String, nullable: true }) rejectionDetail!: string | null;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Renseigné uniquement quand un ADMIN corrige un dossier terminal. Sa présence distingue une correction d’une avancée normale.',
  })
  correctionReason!: string | null;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class BankCaseDetailDto {
  @ApiProperty({ type: () => BankCaseDto }) bankCase!: BankCaseDto;
  @ApiProperty({
    type: () => [BankCaseTransitionDto],
    description: 'Historique complet, du plus ancien au plus récent. Append-only.',
  })
  history!: BankCaseTransitionDto[];
}

export class BankCaseListDto {
  @ApiProperty({ type: () => [BankCaseDto] }) items!: BankCaseDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export class CreateBankCaseDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Prospect actif dont `phase2Status` vaut METHOD_OBTAINED. Toute autre valeur est refusée.',
  })
  @IsUUID()
  prospectId!: string;

  @ApiProperty({
    maxLength: 64,
    description: 'Référence bancaire. Unicité globale sur sa forme normalisée.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  reference!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Défaut : la banque du prospect. L’agent peut en choisir une autre.',
  })
  @IsOptional()
  @IsUUID()
  processingBankId?: string;
}

export class UpdateBankCaseDto {
  @ApiProperty({
    type: Number,
    minimum: 1,
    description: 'Révision attendue. Un écart renvoie BANK_CASE_REV_CONFLICT avec l’état courant.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRev!: number;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  reference?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  processingBankId?: string;
}

export class CreateBankCaseTransitionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetStageId!: string;

  @ApiProperty({ type: Number, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRev!: number;

  @ApiPropertyOptional({
    description: `${MONEY_DESCRIPTION} Obligatoire et strictement positif vers l’étape d’encaissement, interdit ailleurs. Ignoré vers l’étape de rejet, où le serveur force 0.`,
    pattern: MONEY_PATTERN.source,
  })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'amountXof doit être un entier de francs CFA, en chaîne.' })
  amountXof?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Obligatoire vers l’étape de rejet.' })
  @IsOptional()
  @IsUUID()
  rejectionReasonId?: string;

  @ApiPropertyOptional({
    maxLength: 2000,
    description: 'Obligatoire quand le motif de rejet est « AUTRE ».',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionDetail?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class CreateBankCaseCorrectionDto extends CreateBankCaseTransitionDto {
  @ApiProperty({
    maxLength: 2000,
    description:
      'Justification obligatoire. Elle est enregistrée sur la transition et distingue une correction d’une avancée normale.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

export enum BankCaseSortField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  REFERENCE = 'reference',
  CUSTOMER_NAME = 'customerName',
  AMOUNT = 'amountXof',
}

export class BankCaseFilterDto {
  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Recherche libre sur la référence, le nom du client ou son téléphone.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  stageId?: string;

  @ApiPropertyOptional({ enum: BankStageType, enumName: 'BankStageType' })
  @IsOptional()
  @IsEnum(BankStageType)
  stageType?: BankStageType;

  @ApiPropertyOptional({ format: 'uuid', description: 'Banque de traitement du dossier.' })
  @IsOptional()
  @IsUUID()
  banqueId?: string;

  @ApiPropertyOptional({
    enum: Projet,
    enumName: 'Projet',
    description:
      'Parcours suivi par la fiche liée. Sans filtre, les deux projets sortent. Un même numéro peut suivre les deux.',
  })
  @IsOptional()
  @IsEnum(Projet)
  projet?: Projet;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Agent créateur OU dernier intervenant sur le dossier.',
  })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  rejectionReasonId?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne basse sur la création, incluse.',
  })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne haute sur la création, incluse.',
  })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({ description: `Borne basse de montant. ${MONEY_DESCRIPTION}` })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  amountMin?: string;

  @ApiPropertyOptional({ description: `Borne haute de montant. ${MONEY_DESCRIPTION}` })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  amountMax?: string;
}

export class BankCaseQueryDto extends BankCaseFilterDto {
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

  @ApiPropertyOptional({ enum: BankCaseSortField, enumName: 'BankCaseSortField' })
  @IsOptional()
  @IsEnum(BankCaseSortField)
  sortBy?: BankCaseSortField;

  @ApiPropertyOptional({ enum: SortOrder, enumName: 'SortOrder' })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}

export class BankCaseDetailQueryDto {
  @ApiPropertyOptional({
    enum: Projet,
    enumName: 'Projet',
    description:
      'Restreint la lecture aux dossiers dont la fiche suit ce parcours. Un dossier hors parcours répond 404, comme un dossier inexistant.',
  })
  @IsOptional()
  @IsEnum(Projet)
  projet?: Projet;
}

export class ProspectSearchQueryDto {
  @ApiProperty({
    maxLength: 120,
    description:
      'Nom (insensible à la casse et aux accents) ou téléphone sous n’importe quelle forme écrite.',
    example: '77 123 45 67',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  search!: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  @ApiPropertyOptional({
    enum: Projet,
    enumName: 'Projet',
    description: 'Ne propose que les fiches entrées par ce projet. Sans filtre, les deux.',
  })
  @IsOptional()
  @IsEnum(Projet)
  projet?: Projet;
}

export class ProspectSearchItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nom!: string;
  @ApiProperty() prenom!: string;
  @ApiProperty({ description: 'Nom complet, tel qu’il sera copié sur le dossier.' })
  fullName!: string;
  @ApiProperty() phoneE164!: string;
  @ApiProperty({ format: 'uuid' }) banqueId!: string;
  @ApiProperty() banqueName!: string;
}

export class ProspectSearchListDto {
  @ApiProperty({ type: () => [ProspectSearchItemDto] }) items!: ProspectSearchItemDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export class CreateBankCaseStageDto {
  @ApiProperty({
    maxLength: 40,
    pattern: '^[A-Z][A-Z0-9_]*$',
    description: 'Code stable en majuscules. Ne change jamais après création.',
  })
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

  @ApiProperty({ maxLength: 40, description: 'Rôle du design system, pas un hex.' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  color!: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 99,
    description:
      'Position dans le flux ouvert. Défaut : après la dernière étape ouverte. 100 et 101 sont réservées aux étapes système.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  position?: number;
}

export class UpdateBankCaseStageDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label?: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  color?: string;
}

export class ReorderBankCaseStagesDto {
  @ApiProperty({
    type: () => [String],
    format: 'uuid',
    description:
      'Liste ORDONNÉE de toutes les étapes OPEN, actives comme inactives. L’étape initiale doit venir en premier.',
  })
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  stageIds!: string[];
}

export class SetBankCaseStageActiveDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  isActive!: boolean;
}

export class IncludeInactiveQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Inclure les entrées désactivées. Utile à l’administration du workflow.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  includeInactive?: boolean;
}
