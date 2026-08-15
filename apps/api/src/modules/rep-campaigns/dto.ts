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
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CampaignStatus, RepCallOutcome } from '@crm/database';

import { COMMENT_MAX_LENGTH } from '../phase2/attempt-rules.js';
import { MAX_SPREAD_DAYS, MIN_SPREAD_DAYS } from '../phase2/distribution.js';
import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';
import { queryBoolean } from '../../common/dto/query-boolean.js';

/**
 * Contrat HTTP des campagnes d'appels aux REPRÉSENTANTS.
 *
 * Les trois règles du contrat de phase 2 valent ici à l'identique, parce que le
 * client Dart est engendré du même document :
 *
 * 1. Toute propriété de type tableau déclare `type: () => [X]`. Sans cela le
 *    générateur produit `List<dynamic>` : le code compile, l'application
 *    plante à l'exécution sur le premier accès à un champ.
 * 2. `nullable: true` et « facultatif » sont deux choses différentes et sont
 *    distingués ici.
 * 3. Rien de non déterministe : le document engendré est comparé octet à octet
 *    en intégration continue.
 *
 * `PageMetaDto` (commun) est réemployé plutôt que dupliqué. La pagination a
 * UNE forme dans tout le produit, et un doublon de forme identique sous un
 * autre nom obligerait chaque client engendré à porter deux classes pour la
 * même chose, donc le web à écrire deux fois le même composant.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Création
// ─────────────────────────────────────────────────────────────────────────────

export class CreateRepCampaignDto {
  @ApiProperty({ maxLength: 120, example: 'Relance représentants dormants' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'uuid' },
    minItems: 1,
    maxItems: 200,
    description:
      'Commerciaux destinataires, DANS L’ORDRE du tourniquet. Cet ordre est persisté en `position` et fige le contenu de chaque programme.',
  })
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  commercialIds!: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Restreint le tirage à un département. Cumulable avec `iefId`.',
  })
  @IsOptional()
  @IsUUID()
  departementId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Restreint le tirage à une IEF.' })
  @IsOptional()
  @IsUUID()
  iefId?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      'Ne retenir que les représentants n’ayant apporté aucun prospect vivant. C’est la campagne de relance des dormants.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  onlyWithoutProspects?: boolean;

  @ApiPropertyOptional({
    type: Number,
    minimum: MIN_SPREAD_DAYS,
    maximum: MAX_SPREAD_DAYS,
    default: MIN_SPREAD_DAYS,
    description:
      'Étale la file de chaque commercial sur N journées. À 1 (défaut), un seul programme par commercial.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_SPREAD_DAYS)
  @Max(MAX_SPREAD_DAYS)
  spreadDays?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture
// ─────────────────────────────────────────────────────────────────────────────

export class RepCampaignProgressDto {
  @ApiProperty({ type: Number, description: 'Nombre total de tâches affectées.' })
  total!: number;

  @ApiProperty({ type: Number, description: 'Tâches encore ouvertes.' })
  open!: number;

  @ApiProperty({ type: Number, description: 'Tâches abouties : une issue terminale a été saisie.' })
  done!: number;

  @ApiProperty({ type: Number, description: 'Tâches annulées par la clôture de la campagne.' })
  cancelled!: number;
}

export class RepCampaignCommercialDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() username!: string;

  @ApiProperty({ type: Number, description: 'Rang dans le tourniquet, à partir de 1.' })
  position!: number;

  @ApiProperty({ type: () => RepCampaignProgressDto }) progress!: RepCampaignProgressDto;

  @ApiProperty({ type: () => [Number], description: 'Lignes par journée, jour 1 en tête.' })
  perDay!: number[];
}

/**
 * Tentative récente, telle qu'affichée dans le suivi.
 *
 * Le représentant y est désigné par son téléphone et son code court, jamais par
 * son nom : suivre une campagne consiste à savoir QUI a appelé QUEL numéro et
 * avec quel résultat. La même règle que sur les prospects, pour la même raison.
 */
export class RepCampaignAttemptDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) representantId!: string;
  @ApiProperty({ description: 'Code court à six caractères du représentant.' }) shortCode!: string;
  @ApiProperty() phoneE164!: string;

  @ApiProperty({ enum: RepCallOutcome, enumName: 'RepCallOutcome' }) outcome!: RepCallOutcome;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Renseigné si et seulement si l’issue vaut PROSPECTS_PROMISED.',
  })
  promisedProspects!: number | null;

  @ApiProperty({ type: String, nullable: true }) comment!: string | null;

  @ApiProperty({ format: 'uuid', description: 'Commercial qui a RÉELLEMENT passé l’appel.' })
  performedById!: string;

  @ApiProperty() performedByName!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Commercial à qui la tâche était affectée. Peut différer de performedById.',
  })
  assignedToId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class RepCampaignSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: CampaignStatus, enumName: 'CampaignStatus' }) status!: CampaignStatus;

  @ApiProperty({
    description:
      'Graine du tirage, persistée pour pouvoir rejouer et auditer la répartition. Les affectations, elles, sont matérialisées.',
  })
  seed!: string;

  @ApiProperty({ description: 'Libellé lisible du périmètre, composé côté serveur.' })
  scopeLabel!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true }) departementId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) iefId!: string | null;
  @ApiProperty({ type: Boolean }) onlyWithoutProspects!: boolean;

  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty() createdByName!: string;
  @ApiProperty({ type: Number }) commercialCount!: number;

  @ApiProperty({ type: Number, description: 'Journées d’étalement. 1 : programme unique.' })
  spreadDays!: number;

  @ApiProperty({ type: () => RepCampaignProgressDto }) progress!: RepCampaignProgressDto;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) closedAt!: string | null;
}

export class RepCampaignDetailDto extends RepCampaignSummaryDto {
  @ApiProperty({
    type: () => [Number],
    description: 'Lignes par journée, toutes affectations confondues. Jour 1 en tête.',
  })
  perDay!: number[];

  @ApiProperty({ type: () => [RepCampaignCommercialDto], description: 'Ordonnés par position.' })
  commerciaux!: RepCampaignCommercialDto[];

  @ApiProperty({
    type: () => [RepCampaignAttemptDto],
    description: 'Les vingt dernières tentatives, de la plus récente à la plus ancienne.',
  })
  recentAttempts!: RepCampaignAttemptDto[];
}

export class RepCampaignListDto {
  @ApiProperty({ type: () => [RepCampaignSummaryDto] }) items!: RepCampaignSummaryDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export class RepCampaignQueryDto {
  @ApiPropertyOptional({ enum: CampaignStatus, enumName: 'CampaignStatus' })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @ApiPropertyOptional({
    description: 'Recherche libre sur le nom de la campagne.',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  createdById?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/**
 * Aperçu du tirage, AVANT création.
 *
 * Créer une campagne fige des dizaines de milliers d'affectations et rend les
 * représentants inéligibles à toute autre campagne : l'opération ne se
 * rattrape qu'en clôturant. L'aperçu est ce qui permet de constater qu'un
 * périmètre trop large donne 40 000 fiches à sept personnes avant de le
 * découvrir sur le PDF.
 */
export class RepCampaignPreviewQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departementId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  iefId?: string;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  onlyWithoutProspects?: boolean;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 200, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  commercialCount?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: MIN_SPREAD_DAYS,
    maximum: MAX_SPREAD_DAYS,
    default: MIN_SPREAD_DAYS,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_SPREAD_DAYS)
  @Max(MAX_SPREAD_DAYS)
  spreadDays?: number;
}

export class RepCampaignPreviewDto {
  @ApiProperty({ type: Number, description: 'Représentants éligibles sur ce périmètre.' })
  eligible!: number;

  @ApiProperty({ type: Number, description: 'Lignes par commercial, au plus.' })
  perCommercial!: number;

  @ApiProperty({
    type: () => [Number],
    description:
      'Lignes par journée POUR UN commercial, jour 1 en tête. C’est le chiffre qui dit si la journée est tenable.',
  })
  perDay!: number[];

  @ApiProperty({ description: 'Libellé lisible du périmètre.' }) scopeLabel!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tentatives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistrement d'un appel passé à un représentant.
 *
 * L'identifiant est engendré PAR LE CLIENT (UUID v7) et sert de clé
 * d'idempotence, exactement comme pour une tentative de phase 2 : un envoi
 * rejoué après une coupure réseau ne compte pas deux appels.
 */
export class CreateRepCallAttemptDto {
  @ApiProperty({
    format: 'uuid',
    description: 'UUID v7 engendré par le client. Clé d’idempotence.',
  })
  @IsUUID()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  representantId!: string;

  @ApiProperty({ enum: RepCallOutcome, enumName: 'RepCallOutcome' })
  @IsEnum(RepCallOutcome)
  outcome!: RepCallOutcome;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: 10_000,
    description: 'Fiches promises. Admis uniquement pour l’issue PROSPECTS_PROMISED.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  promisedProspects?: number;

  @ApiPropertyOptional({
    type: String,
    maxLength: COMMENT_MAX_LENGTH,
    description: 'Obligatoire et non vide si l’issue vaut OTHER.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(COMMENT_MAX_LENGTH)
  comment?: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Horodatage de l’appel sur le terrain, distinct de son arrivée en base.',
  })
  @IsISO8601()
  clientCreatedAt!: string;
}

export enum RepCallAttemptApplyStatus {
  APPLIED = 'applied',
  /** L'identifiant de tentative était déjà connu : rejeu, rien n'a été réécrit. */
  DUPLICATE = 'duplicate',
}

export class RepCallAttemptResultDto {
  @ApiProperty({ enum: RepCallAttemptApplyStatus, enumName: 'RepCallAttemptApplyStatus' })
  status!: RepCallAttemptApplyStatus;

  @ApiProperty({ format: 'uuid' }) attemptId!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Tâche close par cette tentative, si le représentant en avait une active.',
  })
  taskId!: string | null;

  @ApiProperty({
    type: Boolean,
    description: 'Vrai si l’issue a clos la tâche. Les issues « à rappeler » la laissent ouverte.',
  })
  taskClosed!: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Programme PDF
// ─────────────────────────────────────────────────────────────────────────────

export class RepProgrammeQueryDto {
  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: MAX_SPREAD_DAYS,
    description: 'Journée d’étalement, à partir de 1. Absent : tout le programme du commercial.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SPREAD_DAYS)
  jour?: number;
}
