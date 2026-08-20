import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
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
  Validate,
  ValidateNested,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { ValidatorConstraint } from 'class-validator';
import {
  CallOutcome,
  CallTaskStatus,
  CampaignStatus,
  EnrollmentMethod,
  Projet,
  ProspectStatut,
  ProspectType,
  WhatsappStatus,
} from '@crm/database';

import { BanqueDto, DepartementDto, IefDto, SyndicatDto } from '../referentiels/dto.js';
import { ProspectDto } from '../prospects/dto.js';
import { RepresentantDto } from '../representants/dto.js';
import {
  DATE_PATTERN as VISITE_DATE_PATTERN,
  TIME_PATTERN as VISITE_TIME_PATTERN,
  VisiteReferentielRefDto,
} from '../visites/dto.js';

export const SYNC_MAX_BATCH_SIZE = Number(process.env.SYNC_MAX_BATCH_SIZE ?? 200) || 200;

export const SYNC_MAX_DEPENDENCY_GROUPS = 25;

export enum SyncEntity {
  REPRESENTANT = 'representant',
  REPRESENTANT_COMMENT = 'representant_comment',
  PROSPECT = 'prospect',
  CALL_ATTEMPT = 'call_attempt',
  VISITE = 'visite',
}

export enum SyncOp {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

export enum SyncOpStatus {
  APPLIED = 'applied',
  DUPLICATE = 'duplicate',
  CONFLICT = 'conflict',
  INVALID = 'invalid',
  SKIPPED_DEPENDENCY_FAILED = 'skipped_dependency_failed',
}

export const CLEARABLE_FIELDS = [
  'iefId',
  'notes',
  'whatsappE164',
  'profession',
  'prenom',
  'etablissement',
] as const;

export type ClearableField = (typeof CLEARABLE_FIELDS)[number];

export class SyncEntityDataDto {
  @ApiPropertyOptional({ maxLength: 160, description: 'Représentant : nom complet.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @ApiPropertyOptional({ maxLength: 120, description: 'Prospect : nom.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nom?: string;

  @ApiPropertyOptional({ maxLength: 120, description: 'Prospect : prénom.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  prenom?: string;

  @ApiPropertyOptional({
    maxLength: 40,
    description: 'Téléphone en saisie libre ; normalisé en E.164 par le serveur.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Représentant : département.' })
  @IsOptional()
  @IsUUID()
  departementId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Représentant : IEF de rattachement, facultative. Une version ancienne de ' +
      'l’application ne l’envoie pas ; l’absence du champ laisse la valeur en ' +
      'place et ne l’efface pas.',
  })
  @IsOptional()
  @IsUUID()
  iefId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Prospect : banque.' })
  @IsOptional()
  @IsUUID()
  banqueId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Prospect : syndicat.' })
  @IsOptional()
  @IsUUID()
  syndicatId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Prospect : représentant de rattachement. Sert aussi de clé de groupe.',
  })
  @IsOptional()
  @IsUUID()
  representantId?: string;

  @ApiPropertyOptional({ maxLength: 2000, description: 'Commentaire ajouté à une fiche.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @ApiPropertyOptional({ enum: ProspectStatut, enumName: 'ProspectStatut' })
  @IsOptional()
  @IsEnum(ProspectStatut)
  statut?: ProspectStatut;

  @ApiPropertyOptional({ maxLength: 2000, description: 'Représentant : notes libres.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    enum: WhatsappStatus,
    enumName: 'WhatsappStatus',
    description:
      'Représentant : la question du WhatsApp a-t-elle été posée, et avec quelle réponse.',
  })
  @IsOptional()
  @IsEnum(WhatsappStatus)
  whatsappStatus?: WhatsappStatus;

  @ApiPropertyOptional({
    maxLength: 40,
    description: 'Représentant : numéro WhatsApp, seulement si le statut vaut AUTRE_NUMERO.',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  whatsappE164?: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Profession déclarée. Sert au représentant comme au prospect.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Représentant : l’établissement où il exerce. Ni l’IEF ni le département.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  etablissement?: string;

  @ApiPropertyOptional({
    enum: Projet,
    enumName: 'Projet',
    description: 'Prospect : le projet dont il relève. CHUES par défaut côté serveur.',
  })
  @IsOptional()
  @IsEnum(Projet)
  projet?: Projet;

  @ApiPropertyOptional({
    enum: ProspectType,
    enumName: 'ProspectType',
    description: 'Prospect hors CHUES : ce qu’il est. Jamais obligatoire.',
  })
  @IsOptional()
  @IsEnum(ProspectType)
  type?: ProspectType;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 600,
    description: 'Prospect : durée du système de paiement, en MOIS.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  dureeSystemeMois?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Prospect : canal de provenance, choisi dans le référentiel.',
  })
  @IsOptional()
  @IsUUID()
  canalProvenanceId?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Horodatage de la saisie terrain.' })
  @IsOptional()
  @IsISO8601()
  clientCreatedAt?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Tentative d’appel : prospect concerné. Sert aussi de clé de groupe.',
  })
  @IsOptional()
  @IsUUID()
  prospectId?: string;

  @ApiPropertyOptional({ enum: CallOutcome, enumName: 'CallOutcome' })
  @IsOptional()
  @IsEnum(CallOutcome)
  outcome?: CallOutcome;

  @ApiPropertyOptional({
    maxLength: 40,
    description:
      'Tentative d’appel : code du motif d’issue. FACULTATIF POUR TOUJOURS. Un lot qui ne le ' +
      'porte pas résout le motif système dont le code égale outcome.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  reasonCode?: string;

  @ApiPropertyOptional({
    enum: EnrollmentMethod,
    enumName: 'EnrollmentMethod',
    description: 'Obligatoire si et seulement si outcome vaut METHOD_OBTAINED.',
  })
  @IsOptional()
  @IsEnum(EnrollmentMethod)
  method?: EnrollmentMethod;

  @ApiPropertyOptional({
    maxLength: 2000,
    description: 'Tentative d’appel : obligatoire et non vide si outcome vaut OTHER.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Tentative d’appel : date du rappel promis. Obligatoire si et seulement si outcome vaut ' +
      'CALLBACK. Une version ancienne de l’application ne l’envoie pas.',
  })
  @IsOptional()
  @IsISO8601()
  callbackAt?: string;

  @ApiPropertyOptional({ maxLength: 160, description: 'Visite : nom et prénom du visiteur.' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  visitorName?: string;

  @ApiPropertyOptional({ example: '2026-01-06', description: 'Visite : jour, à Dakar.' })
  @IsOptional()
  @IsString()
  @Matches(VISITE_DATE_PATTERN)
  visitDate?: string;

  @ApiPropertyOptional({
    example: '11:08',
    description: 'Visite : heure, omise si elle n’a pas été relevée.',
  })
  @IsOptional()
  @IsString()
  @Matches(VISITE_TIME_PATTERN)
  visitTime?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Visite : entreprise du visiteur.' })
  @IsOptional()
  @IsUUID()
  entrepriseId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Visite : objet de la visite.' })
  @IsOptional()
  @IsUUID()
  objetId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Visite : direction ou étage visé.' })
  @IsOptional()
  @IsUUID()
  directionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Visite : destinataire visé.' })
  @IsOptional()
  @IsUUID()
  destinataireId?: string;
}

export class SyncOperationDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Identifiant unique de l’opération, stable entre deux rejeux.',
  })
  @IsUUID()
  opId!: string;

  @ApiProperty({
    type: Number,
    minimum: 0,
    description: 'Ordre d’application voulu par le client.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  seq!: number;

  @ApiProperty({ enum: SyncEntity, enumName: 'SyncEntity' })
  @IsEnum(SyncEntity)
  entity!: SyncEntity;

  @ApiProperty({ enum: SyncOp, enumName: 'SyncOp' })
  @IsEnum(SyncOp)
  op!: SyncOp;

  @ApiProperty({
    format: 'uuid',
    description: 'Identifiant de la ligne visée, généré par le client.',
  })
  @IsUUID()
  entityId!: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601()
  clientUpdatedAt!: string;

  @ApiPropertyOptional({
    type: Number,
    description:
      'Révision serveur sur laquelle le client s’est basé. Fournie sur update/delete, elle transforme une écriture aveugle en écriture conditionnelle.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseRev?: number;

  @ApiPropertyOptional({ type: () => SyncEntityDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SyncEntityDataDto)
  data?: SyncEntityDataDto;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Champs que le client a explicitement VIDÉS. Un champ simplement absent de `data` reste inchangé ; ' +
      'un champ nommé ici est écrit à NULL. Valeurs acceptées : ' +
      CLEARABLE_FIELDS.join(', ') +
      '.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CLEARABLE_FIELDS.length)
  @IsIn([...CLEARABLE_FIELDS], { each: true })
  clearedFields?: string[];
}

@ValidatorConstraint({ name: 'maxDependencyGroups', async: false })
export class MaxDependencyGroupsConstraint implements ValidatorConstraintInterface {
  validate(operations: unknown): boolean {
    if (!Array.isArray(operations)) return true;
    const groups = new Set<string>();
    for (const operation of operations as SyncOperationDto[]) {
      groups.add(dependencyKeyOf(operation));
    }
    return groups.size <= SYNC_MAX_DEPENDENCY_GROUPS;
  }

  defaultMessage(): string {
    return `Un lot ne peut pas couvrir plus de ${String(SYNC_MAX_DEPENDENCY_GROUPS)} représentants. Découpez la synchronisation.`;
  }
}

export function dependencyKeyOf(operation: {
  entity: SyncEntity;
  entityId: string;
  data?: { representantId?: string; prospectId?: string } | undefined;
}): string {
  if (operation.entity === SyncEntity.REPRESENTANT) return `representant:${operation.entityId}`;

  if (operation.entity === SyncEntity.REPRESENTANT_COMMENT) {
    return `representant:${operation.data?.representantId ?? operation.entityId}`;
  }

  if (operation.entity === SyncEntity.CALL_ATTEMPT) {
    return `prospect:${operation.data?.prospectId ?? operation.entityId}`;
  }

  // Une visite ne dépend de rien : chaque inscription est sa propre partition.
  if (operation.entity === SyncEntity.VISITE) {
    return `visite:${operation.entityId}`;
  }

  const parent = operation.data?.representantId;
  return parent ? `representant:${parent}` : `prospect:${operation.entityId}`;
}

export class SyncPushDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Identifiant du lot. Doit être répété à l’identique dans l’en-tête Idempotency-Key.',
  })
  @IsUUID()
  clientBatchId!: string;

  @ApiProperty({ type: Number, minimum: 1, description: 'Version du format de charge utile.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000)
  payloadVersion!: number;

  @ApiProperty({ type: () => [SyncOperationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SYNC_MAX_BATCH_SIZE)
  @Validate(MaxDependencyGroupsConstraint)
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations!: SyncOperationDto[];

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    description:
      'Opérations restant dans la file d’attente de l’appareil APRÈS ce lot. ' +
      'Le serveur ne peut pas la deviner. Facultatif sans limite de temps : une ' +
      'version déjà déployée ne l’envoie pas.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  pendingOps?: number;

  @ApiPropertyOptional({
    maxLength: 32,
    description: 'Version de l’application mobile, telle qu’elle s’annonce. Facultative.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}

export class SyncOperationResultDto {
  @ApiProperty({ format: 'uuid' }) opId!: string;

  @ApiProperty({ enum: SyncOpStatus, enumName: 'SyncOpStatus' })
  status!: SyncOpStatus;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  entityId!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Révision serveur après écriture.' })
  rev!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  serverUpdatedAt!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Code métier lisible par le client : PROSPECT_PHONE_CONFLICT, REV_CONFLICT, …',
  })
  errorCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  error!: string | null;
}

export class SyncPushResponseDto {
  @ApiProperty({ format: 'uuid' }) batchId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) serverTime!: string;

  @ApiProperty({ type: () => [SyncOperationResultDto] })
  results!: SyncOperationResultDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Toujours null : le serveur ignore la position de pull du client, et en fabriquer une lui ferait sauter les écritures des autres appareils. Le client conserve son propre curseur.',
  })
  nextCursor!: string | null;
}

export class SyncPullQueryDto {
  @ApiPropertyOptional({
    description: 'Curseur opaque renvoyé par l’appel précédent. Absent : synchronisation complète.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  since?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 1000, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000)
  limit?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    description:
      'Opérations en attente de remontée dans l’appareil. Le serveur ne peut pas ' +
      'la deviner. Facultatif sans limite de temps.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  pendingOps?: number;

  @ApiPropertyOptional({
    maxLength: 32,
    description: 'Version de l’application mobile, telle qu’elle s’annonce. Facultative.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}

/**
 * La campagne telle que le terrain la voit : son nom, son etat, rien de son
 * tirage. Le telephone en a besoin pour dire A QUELLE FILE une fiche appartient,
 * sans quoi deux campagnes se melangent dans une seule liste.
 */
export class SyncCallCampaignDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: CampaignStatus, enumName: 'CampaignStatus' }) status!: CampaignStatus;
  @ApiProperty({ type: Number, description: 'Journees d’etalement de la file.' })
  spreadDays!: number;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  closedAt!: string | null;
}

/** Une ligne de la file d’un teleconseiller : quelle fiche, quel rang, quel jour. */
export class SyncCallTaskDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) campaignId!: string;
  @ApiProperty({ format: 'uuid' }) prospectId!: string;
  @ApiProperty({ type: Number, description: 'Rang dans le programme, a partir de 1.' })
  position!: number;
  @ApiProperty({ type: Number, description: 'Journee d’etalement, a partir de 0.' })
  dayIndex!: number;
  @ApiProperty({ enum: CallTaskStatus, enumName: 'CallTaskStatus' }) status!: CallTaskStatus;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

/**
 * Une ligne du registre, telle qu'elle voyage vers le téléphone. Le serveur
 * seul l'écrit : pas de `rev`, un pull rejoué recopie simplement la même ligne.
 */
export class SyncVisiteDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'V-2026-000412' }) reference!: string;
  @ApiProperty({ example: '2026-01-06' }) date!: string;
  @ApiProperty({ type: String, nullable: true, example: '11:08' }) time!: string | null;
  @ApiProperty() visitorName!: string;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ type: String, nullable: true }) phoneE164!: string | null;
  @ApiProperty({ type: () => VisiteReferentielRefDto }) entreprise!: VisiteReferentielRefDto;
  @ApiProperty({ type: () => VisiteReferentielRefDto }) objet!: VisiteReferentielRefDto;
  @ApiProperty({ type: () => VisiteReferentielRefDto, nullable: true })
  direction!: VisiteReferentielRefDto | null;
  @ApiProperty({ type: () => VisiteReferentielRefDto, nullable: true })
  destinataire!: VisiteReferentielRefDto | null;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class SyncChangesDto {
  @ApiProperty({ type: () => [DepartementDto] }) departements!: DepartementDto[];
  @ApiProperty({ type: () => [IefDto] }) iefs!: IefDto[];
  @ApiProperty({ type: () => [BanqueDto] }) banques!: BanqueDto[];
  @ApiProperty({ type: () => [SyndicatDto] }) syndicats!: SyndicatDto[];
  @ApiProperty({ type: () => [RepresentantDto] }) representants!: RepresentantDto[];
  @ApiProperty({ type: () => [ProspectDto] }) prospects!: ProspectDto[];
  @ApiProperty({ type: () => [SyncCallCampaignDto] }) callCampaigns!: SyncCallCampaignDto[];
  @ApiProperty({ type: () => [SyncCallTaskDto] }) callTasks!: SyncCallTaskDto[];
  @ApiProperty({ type: () => [SyncVisiteDto] }) visites!: SyncVisiteDto[];
}

export class SyncDeletionDto {
  @ApiProperty({ enum: SyncEntity, enumName: 'SyncEntity' }) entity!: SyncEntity;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'date-time' }) deletedAt!: string;
}

export class SyncPullResponseDto {
  @ApiProperty({ type: () => SyncChangesDto }) changes!: SyncChangesDto;

  @ApiProperty({ type: () => [SyncDeletionDto] })
  deletions!: SyncDeletionDto[];

  @ApiProperty({ description: 'À renvoyer tel quel dans le prochain appel.' })
  nextCursor!: string;

  @ApiProperty({ type: Boolean, description: 'Vrai si au moins un flux a d’autres pages.' })
  hasMore!: boolean;

  @ApiProperty({ type: String, format: 'date-time' }) serverTime!: string;
}
