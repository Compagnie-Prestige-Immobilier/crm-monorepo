import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  Validate,
  ValidateNested,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { ValidatorConstraint } from 'class-validator';
import { CallOutcome, EnrollmentMethod, ProspectStatut } from '@crm/database';

import { BanqueDto, DepartementDto, IefDto, SyndicatDto } from '../referentiels/dto.js';
import { ProspectDto } from '../prospects/dto.js';
import { RepresentantDto } from '../representants/dto.js';

/**
 * Plafonds lus au chargement du module.
 *
 * Les décorateurs class-validator sont évalués une fois, à l'import : la valeur
 * ne peut donc pas venir d'une injection. On lit `process.env` directement, avec
 * le même défaut que le schéma zod.
 */
export const SYNC_MAX_BATCH_SIZE = Number(process.env.SYNC_MAX_BATCH_SIZE ?? 200) || 200;

/**
 * Un lot ne peut pas dépasser 25 groupes de dépendance.
 *
 * Chaque groupe est une transaction ; 25 transactions bornent le temps
 * d'occupation d'une connexion, et donc l'effet d'un client qui enverrait un
 * lot énorme après trois semaines hors ligne.
 */
export const SYNC_MAX_DEPENDENCY_GROUPS = 25;

export enum SyncEntity {
  REPRESENTANT = 'representant',
  PROSPECT = 'prospect',
  CALL_ATTEMPT = 'call_attempt',
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

/**
 * Charge utile d'une opération, tous champs optionnels.
 *
 * Les deux entités partagent un seul DTO plutôt qu'une union discriminée : une
 * union produit en Dart une classe `OneOf` que le code applicatif doit
 * déballer, alors qu'un objet plat aux champs optionnels donne un type utile
 * immédiatement. La validation par entité (quels champs sont obligatoires pour
 * un `representant.create`) est faite dans le service, et une opération mal
 * formée ressort en `invalid` DANS le corps de réponse — jamais en 400 pour
 * tout le lot, ce qui condamnerait les 199 autres opérations.
 */
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

  @ApiPropertyOptional({ enum: ProspectStatut, enumName: 'ProspectStatut' })
  @IsOptional()
  @IsEnum(ProspectStatut)
  statut?: ProspectStatut;

  @ApiPropertyOptional({ maxLength: 2000, description: 'Représentant : notes libres.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Horodatage de la saisie terrain.' })
  @IsOptional()
  @IsISO8601()
  clientCreatedAt?: string;

  // ── Phase 2 : tentative d'appel ────────────────────────────────────────
  // Ces champs ne sont lus que pour `entity = call_attempt`. Les règles
  // croisées (méthode obligatoire si et seulement si METHOD_OBTAINED,
  // commentaire obligatoire pour OTHER) sont vérifiées par le module phase 2,
  // qui en est la seule autorité — les dupliquer ici les ferait diverger.

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
}

/**
 * Vérifie le plafond de groupes de dépendance.
 *
 * Le nombre de groupes ne se déduit pas d'un décorateur de cardinalité : il
 * dépend du contenu des opérations. Le contrôle est donc porté par une
 * contrainte dédiée, pour qu'il reste une règle de validation du DTO — refusée
 * en 400 avant tout accès à la base — et non un test enfoui dans le service.
 */
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

/**
 * Clé de groupe transactionnel : l'identifiant du représentant.
 *
 * Un prospect en création est groupé avec son représentant, pour qu'il ne
 * puisse pas atterrir si son parent a échoué. Une mise à jour ou une
 * suppression de prospect, dont le parent existe déjà, forme son propre groupe :
 * les mêler ferait échouer des lignes indépendantes ensemble.
 */
export function dependencyKeyOf(operation: {
  entity: SyncEntity;
  entityId: string;
  data?: { representantId?: string; prospectId?: string } | undefined;
}): string {
  if (operation.entity === SyncEntity.REPRESENTANT) return `representant:${operation.entityId}`;

  // Une tentative d'appel de phase 2 est groupée sur SON prospect, jamais sur
  // le représentant : le prospect existe déjà en base au moment de l'appel
  // (l'annuaire ne contient que des lignes synchronisées), et le grouper avec
  // une saisie de phase 1 en cours ferait échouer ensemble deux choses sans
  // rapport.
  if (operation.entity === SyncEntity.CALL_ATTEMPT) {
    return `prospect:${operation.data?.prospectId ?? operation.entityId}`;
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

// ─── Pull ───────────────────────────────────────────────────────────────────

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
}

export class SyncChangesDto {
  @ApiProperty({ type: () => [DepartementDto] }) departements!: DepartementDto[];
  @ApiProperty({ type: () => [IefDto] }) iefs!: IefDto[];
  @ApiProperty({ type: () => [BanqueDto] }) banques!: BanqueDto[];
  @ApiProperty({ type: () => [SyndicatDto] }) syndicats!: SyndicatDto[];
  @ApiProperty({ type: () => [RepresentantDto] }) representants!: RepresentantDto[];
  @ApiProperty({ type: () => [ProspectDto] }) prospects!: ProspectDto[];
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
