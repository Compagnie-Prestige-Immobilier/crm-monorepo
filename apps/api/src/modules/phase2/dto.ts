import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
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
import {
  CallOutcome,
  CallTaskStatus,
  CampaignScope,
  CampaignStatus,
  EnrollmentMethod,
  Phase2Status,
} from '@crm/database';

import { COMMENT_MAX_LENGTH } from './attempt-rules.js';

/**
 * Contrat HTTP de la phase 2.
 *
 * Trois règles gouvernent ce fichier, parce que le client Dart en est engendré :
 *
 * 1. Toute propriété de type tableau déclare `type: () => [X]`. Sans cela le
 *    générateur produit `List<dynamic>` : le code compile, l'application
 *    plante à l'exécution sur le premier accès à un champ.
 * 2. `nullable: true` et « facultatif » sont deux choses différentes et sont
 *    distingués ici. Un champ nullable est TOUJOURS présent et peut valoir
 *    null ; un champ facultatif peut être absent.
 * 3. Rien de non déterministe : le document engendré est comparé octet à octet
 *    en intégration continue.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Métadonnées de page propres à la phase 2.
 *
 * Volontairement distinctes de `PageMetaDto` : deux schémas OpenAPI ne peuvent
 * pas porter le même nom, et emprunter celui d'un autre module lierait ce
 * contrat aux évolutions d'une pagination qui n'a rien à voir.
 */
export class Phase2PageMetaDto {
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) pageSize!: number;
  @ApiProperty({ type: Number }) pageCount!: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Campagnes — création
// ─────────────────────────────────────────────────────────────────────────────

export class CreateCampaignDto {
  @ApiProperty({ maxLength: 120, example: 'Campagne CHUES — avril' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    enum: CampaignScope,
    enumName: 'CampaignScope',
    description:
      'Périmètre du tirage. BDD1..BDD4 sont les segments partagés ; ALL réunit les quatre sans recouvrement.',
  })
  @IsEnum(CampaignScope)
  scope!: CampaignScope;

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
}

// ─────────────────────────────────────────────────────────────────────────────
// Campagnes — lecture
// ─────────────────────────────────────────────────────────────────────────────

export class CampaignProgressDto {
  @ApiProperty({ type: Number, description: 'Nombre total de tâches affectées.' })
  total!: number;

  @ApiProperty({ type: Number, description: 'Tâches encore ouvertes.' })
  open!: number;

  @ApiProperty({ type: Number, description: 'Tâches abouties : une issue terminale a été saisie.' })
  done!: number;

  @ApiProperty({ type: Number, description: 'Tâches annulées par la clôture de la campagne.' })
  cancelled!: number;
}

export class CampaignCommercialDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() username!: string;

  @ApiProperty({ type: Number, description: 'Rang dans le tourniquet, à partir de 1.' })
  position!: number;

  @ApiProperty({ type: () => CampaignProgressDto }) progress!: CampaignProgressDto;
}

/**
 * Tentative récente, telle qu'affichée dans le panneau d'administration.
 *
 * Le prospect y est désigné par son téléphone et son code court, jamais par son
 * nom : le suivi d'une campagne consiste à savoir QUI a appelé QUEL numéro et
 * avec quel résultat. Un administrateur qui a besoin de l'identité passe par la
 * fiche prospect, où l'accès est tracé.
 */
export class CampaignAttemptDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) prospectId!: string;
  @ApiProperty({ description: 'Code court à six caractères du prospect.' }) shortCode!: string;
  @ApiProperty() phoneE164!: string;

  @ApiProperty({ enum: CallOutcome, enumName: 'CallOutcome' }) outcome!: CallOutcome;

  @ApiProperty({
    enum: EnrollmentMethod,
    enumName: 'EnrollmentMethod',
    nullable: true,
    description: 'Renseignée si et seulement si l’issue vaut METHOD_OBTAINED.',
  })
  method!: EnrollmentMethod | null;

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

export class CampaignSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: CampaignScope, enumName: 'CampaignScope' }) scope!: CampaignScope;
  @ApiProperty({ description: 'Libellé lisible du périmètre, issu de la définition partagée.' })
  scopeLabel!: string;
  @ApiProperty({ enum: CampaignStatus, enumName: 'CampaignStatus' }) status!: CampaignStatus;

  @ApiProperty({
    description:
      'Graine du tirage, persistée pour pouvoir rejouer et auditer la répartition. Les affectations, elles, sont matérialisées.',
  })
  seed!: string;

  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty() createdByName!: string;
  @ApiProperty({ type: Number }) commercialCount!: number;
  @ApiProperty({ type: () => CampaignProgressDto }) progress!: CampaignProgressDto;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) closedAt!: string | null;
}

export class CampaignDetailDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: CampaignScope, enumName: 'CampaignScope' }) scope!: CampaignScope;
  @ApiProperty() scopeLabel!: string;
  @ApiProperty({ enum: CampaignStatus, enumName: 'CampaignStatus' }) status!: CampaignStatus;
  @ApiProperty() seed!: string;
  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty() createdByName!: string;
  @ApiProperty({ type: Number }) commercialCount!: number;
  @ApiProperty({ type: () => CampaignProgressDto }) progress!: CampaignProgressDto;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) closedAt!: string | null;

  @ApiProperty({ type: () => [CampaignCommercialDto], description: 'Ordonnés par position.' })
  commerciaux!: CampaignCommercialDto[];

  @ApiProperty({
    type: () => [CampaignAttemptDto],
    description: 'Les vingt dernières tentatives, de la plus récente à la plus ancienne.',
  })
  recentAttempts!: CampaignAttemptDto[];
}

export class CampaignListDto {
  @ApiProperty({ type: () => [CampaignSummaryDto] }) items!: CampaignSummaryDto[];
  @ApiProperty({ type: () => Phase2PageMetaDto }) meta!: Phase2PageMetaDto;
}

export class CampaignQueryDto {
  @ApiPropertyOptional({ enum: CampaignStatus, enumName: 'CampaignStatus' })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

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

// ─────────────────────────────────────────────────────────────────────────────
// Annuaire hors ligne
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UNE ENTRÉE D'ANNUAIRE NE PORTE QUE SIX CHAMPS. C'est une frontière de
 * confidentialité, pas une commodité.
 *
 * L'annuaire est répliqué sur des téléphones personnels, hors ligne, chez tous
 * les commerciaux : y ajouter le nom, la banque ou le syndicat reviendrait à
 * distribuer la base nominative complète à chaque terminal, et une seule perte
 * d'appareil suffirait à la faire fuiter. Le commercial n'a besoin que de
 * savoir quel numéro appeler et si le dossier est déjà réglé.
 *
 * Un test vérifie que l'objet renvoyé possède EXACTEMENT ces clés. Ajouter un
 * champ ici doit donc être un acte délibéré qui casse ce test.
 */
export class DirectoryEntryDto {
  @ApiProperty({ format: 'uuid' }) prospectId!: string;
  @ApiProperty({ description: 'Numéro normalisé E.164.' }) phoneE164!: string;

  @ApiProperty({ enum: Phase2Status, enumName: 'Phase2Status' }) phase2Status!: Phase2Status;

  @ApiProperty({
    enum: EnrollmentMethod,
    enumName: 'EnrollmentMethod',
    nullable: true,
    description: 'Non nulle si et seulement si phase2Status vaut METHOD_OBTAINED.',
  })
  enrollmentMethod!: EnrollmentMethod | null;

  @ApiProperty({ type: Number, description: 'Révision serveur, pour la résolution de conflits.' })
  rev!: number;

  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class DirectoryPageDto {
  @ApiProperty({ type: () => [DirectoryEntryDto] }) entries!: DirectoryEntryDto[];

  @ApiProperty({ description: 'Curseur opaque à renvoyer tel quel au prochain appel.' })
  nextCursor!: string;

  @ApiProperty({
    type: Boolean,
    description: 'Vrai tant qu’il reste des pages ; le client boucle jusqu’à faux.',
  })
  hasMore!: boolean;

  @ApiProperty({ type: String, format: 'date-time' }) serverTime!: string;
}

export class DirectoryQueryDto {
  @ApiPropertyOptional({
    description: 'Curseur renvoyé par l’appel précédent. Absent : annuaire complet.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  since?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 5000, default: 2000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5_000)
  limit?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tentatives d'appel — contrat consommé par le module de synchronisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Charge utile d'une opération `call_attempt` du push de synchronisation.
 *
 * L'identifiant est engendré PAR LE MOBILE (UUID v7) et sert de clé
 * d'idempotence : un lot rejoué après une coupure réseau ne compte pas deux
 * appels.
 */
export class CallAttemptOpDto {
  @ApiProperty({
    format: 'uuid',
    description: 'UUID v7 engendré par le mobile. Clé d’idempotence.',
  })
  @IsUUID()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  prospectId!: string;

  @ApiProperty({ enum: CallOutcome, enumName: 'CallOutcome' })
  @IsEnum(CallOutcome)
  outcome!: CallOutcome;

  @ApiPropertyOptional({
    enum: EnrollmentMethod,
    enumName: 'EnrollmentMethod',
    description: 'Obligatoire si et seulement si outcome vaut METHOD_OBTAINED.',
  })
  @IsOptional()
  @IsEnum(EnrollmentMethod)
  method?: EnrollmentMethod;

  @ApiPropertyOptional({
    type: String,
    maxLength: COMMENT_MAX_LENGTH,
    description: 'Obligatoire et non vide si outcome vaut OTHER.',
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

/** État de phase 2 d'un prospect, tel que le serveur le connaît. */
export class ProspectPhase2StateDto {
  @ApiProperty({ format: 'uuid' }) prospectId!: string;
  @ApiProperty({ enum: Phase2Status, enumName: 'Phase2Status' }) phase2Status!: Phase2Status;

  @ApiProperty({ enum: EnrollmentMethod, enumName: 'EnrollmentMethod', nullable: true })
  enrollmentMethod!: EnrollmentMethod | null;

  @ApiProperty({ type: Number }) rev!: number;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Commercial dont l’appel a clos le dossier.',
  })
  capturedById!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true }) capturedAt!: string | null;
}

export enum CallAttemptApplyStatus {
  APPLIED = 'applied',
  /** L'identifiant de tentative était déjà connu : rejeu, rien n'a été réécrit. */
  DUPLICATE = 'duplicate',
}

export class CallAttemptResultDto {
  @ApiProperty({ enum: CallAttemptApplyStatus, enumName: 'CallAttemptApplyStatus' })
  status!: CallAttemptApplyStatus;

  @ApiProperty({ format: 'uuid' }) attemptId!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Tâche close par cette tentative, si le prospect en avait une active.',
  })
  taskId!: string | null;

  @ApiProperty({
    enum: CallTaskStatus,
    enumName: 'CallTaskStatus',
    nullable: true,
    description: 'Statut de cette tâche après application.',
  })
  taskStatus!: CallTaskStatus | null;

  @ApiProperty({ type: () => ProspectPhase2StateDto }) state!: ProspectPhase2StateDto;
}

/**
 * Corps renvoyé quand une transition terminale arrive trop tard.
 *
 * Il embarque l'état serveur COURANT : sans lui, le client ne pourrait
 * qu'effacer sa saisie ou la rejouer indéfiniment. Avec lui, il garde son
 * entrée locale comme conflit visible et la rapproche de ce que le serveur
 * connaît. Seul un ADMIN peut corriger ensuite depuis le web.
 */
export class Phase2ConflictDto {
  @ApiProperty({ enum: ['PHASE2_ALREADY_COMPLETED'] }) code!: 'PHASE2_ALREADY_COMPLETED';
  @ApiProperty() message!: string;
  @ApiProperty({ type: () => ProspectPhase2StateDto }) state!: ProspectPhase2StateDto;
}
