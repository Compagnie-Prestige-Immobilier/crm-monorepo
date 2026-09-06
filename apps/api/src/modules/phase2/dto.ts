import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsEmail,
  IsBoolean,
  IsISO8601,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  DEVICE_CALL_MAX_DURATION_SECONDS,
  DEVICE_CALL_TYPES,
  type DeviceCallType,
} from '../../common/device-call.js';
import {
  CallOutcome,
  EnrollmentMethod,
  PaymentMode,
  Phase2Status,
  Projet,
  ProspectType,
} from '@crm/database';

import {
  COMMENT_MAX_LENGTH,
  DUREE_ETABLISSEMENT_MAX_MOIS,
  EMAIL_MAX_LENGTH,
} from './attempt-rules.js';
export class CallRecordingDto {
  @ApiProperty({ format: 'uuid' }) attemptId!: string;
  @ApiProperty({ type: Number }) bytes!: number;
}

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

  @ApiPropertyOptional({ enum: Projet, enumName: 'Projet' })
  @IsOptional()
  @IsEnum(Projet)
  projet?: Projet;

  @ApiProperty({ enum: CallOutcome, enumName: 'CallOutcome' })
  @IsEnum(CallOutcome)
  outcome!: CallOutcome;

  @ApiPropertyOptional({
    maxLength: 40,
    description:
      'Code du motif d’issue saisi sur le terrain. FACULTATIF POUR TOUJOURS : une version ' +
      'installée ne l’envoie pas, et son absence fait résoudre le motif système dont le code ' +
      'égale outcome.',
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
    type: String,
    maxLength: COMMENT_MAX_LENGTH,
    description:
      'Le commentaire de l’appel. C’est AUSSI le « commentaire » du formulaire de conversion : ' +
      'il n’y a qu’un champ libre par tentative. Obligatoire et non vide si outcome vaut OTHER.',
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

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Date du rappel promis. Obligatoire si et seulement si outcome vaut CALLBACK, et ' +
      'postérieure à clientCreatedAt. Une version ancienne de l’application ne l’envoie pas : ' +
      'son absence sur les autres issues reste valide indéfiniment.',
  })
  @IsOptional()
  @IsISO8601()
  callbackAt?: string;

  @ApiPropertyOptional({
    enum: DEVICE_CALL_TYPES,
    description: 'Type lu dans le journal d’appels Android pour l’appel lancé depuis la fiche.',
  })
  @IsOptional()
  @IsIn(DEVICE_CALL_TYPES)
  deviceCallType?: DeviceCallType;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: DEVICE_CALL_MAX_DURATION_SECONDS,
    description: 'Durée en secondes lue dans le journal d’appels Android.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(DEVICE_CALL_MAX_DURATION_SECONDS)
  deviceCallDurationSeconds?: number;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Heure de l’appel lue dans le journal d’appels Android.',
  })
  @IsOptional()
  @IsISO8601()
  deviceCallAt?: string;

  // ── Renseignements de conversion (phase 3) ────────────────────────────────
  //
  // DEUX destinations, et une seule vérité par champ.
  //
  //  · `email`, `fonctionnaire`, `engagementEnCours`, `dureeEtablissementMois`
  //    et `rendezVousAt` sont écrits SUR LA TENTATIVE : ce sont des faits datés
  //    de l'appel, que la fiche ne porte pas.
  //  · `nom`, `prenom`, `profession`, `banqueId` et `syndicatId` sont écrits SUR
  //    LE PROSPECT, qui en reste la seule vérité. Absents, ils laissent la
  //    valeur en place ; ils ne l'effacent jamais.
  //
  // `phoneE164` n'est PAS modifiable ici : c'est la clé de l'annuaire hors
  // ligne, sous index unique partiel. Une correction de numéro passe par la
  // mise à jour du prospect.

  @ApiPropertyOptional({
    type: String,
    maxLength: EMAIL_MAX_LENGTH,
    description: 'Adresse électronique recueillie pendant l’appel. Écrite sur la tentative.',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Le prospect est-il fonctionnaire. Absent : la question n’a pas été posée.',
  })
  @IsOptional()
  @IsBoolean()
  fonctionnaire?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Un engagement bancaire est-il en cours. Absent : question non posée.',
  })
  @IsOptional()
  @IsBoolean()
  engagementEnCours?: boolean;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: DUREE_ETABLISSEMENT_MAX_MOIS,
    description:
      'Ancienneté dans l’établissement, en MOIS. Distincte de `dureeSystemeMois` du prospect, ' +
      'qui est la durée du système de paiement.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DUREE_ETABLISSEMENT_MAX_MOIS)
  dureeEtablissementMois?: number;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Date du rendez-vous pris. Obligatoire si et seulement si method vaut APPOINTMENT, et ' +
      'postérieure à clientCreatedAt. Refusée sur toute autre méthode.',
  })
  @IsOptional()
  @IsISO8601()
  rendezVousAt?: string;

  @ApiPropertyOptional({ maxLength: 120, description: 'Corrige le nom DU PROSPECT.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nom?: string;

  @ApiPropertyOptional({ maxLength: 120, description: 'Corrige le prénom DU PROSPECT.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  prenom?: string;

  @ApiPropertyOptional({ maxLength: 120, description: 'Corrige la profession DU PROSPECT.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Corrige la banque DU PROSPECT.' })
  @IsOptional()
  @IsUUID()
  banqueId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Corrige le syndicat DU PROSPECT.' })
  @IsOptional()
  @IsUUID()
  syndicatId?: string;

  @ApiPropertyOptional({
    enum: ProspectType,
    enumName: 'ProspectType',
    description: 'Corrige la situation DU PROSPECT.',
  })
  @IsOptional()
  @IsEnum(ProspectType)
  type?: ProspectType;

  @ApiPropertyOptional({ format: 'uuid', description: 'Corrige la tranche de revenu DU PROSPECT.' })
  @IsOptional()
  @IsUUID()
  incomeBandId?: string;

  @ApiPropertyOptional({
    enum: PaymentMode,
    enumName: 'PaymentMode',
    description: 'Corrige le mode de paiement DU PROSPECT.',
  })
  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 300,
    description: 'Corrige la durée du système de paiement DU PROSPECT, en MOIS.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  dureeSystemeMois?: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    description:
      'Réponses aux champs que l’administrateur a ajoutés au formulaire, par identifiant ' +
      'de champ. Écrites SUR LE PROSPECT, fusionnées : une clé absente laisse la réponse ' +
      'en place. Elles n’alimentent aucun indicateur.',
  })
  @IsOptional()
  @IsObject()
  champsLibres?: Record<string, string>;
}

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
  DUPLICATE = 'duplicate',
}

export class CallAttemptResultDto {
  @ApiProperty({ enum: CallAttemptApplyStatus, enumName: 'CallAttemptApplyStatus' })
  status!: CallAttemptApplyStatus;

  @ApiProperty({ format: 'uuid' }) attemptId!: string;

  @ApiProperty({ type: () => ProspectPhase2StateDto }) state!: ProspectPhase2StateDto;
}

export class Phase2ConflictDto {
  @ApiProperty({ enum: ['PHASE2_ALREADY_COMPLETED'] }) code!: 'PHASE2_ALREADY_COMPLETED';
  @ApiProperty() message!: string;
  @ApiProperty({ type: () => ProspectPhase2StateDto }) state!: ProspectPhase2StateDto;
}
