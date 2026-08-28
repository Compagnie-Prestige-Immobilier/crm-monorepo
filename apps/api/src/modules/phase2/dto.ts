import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsBoolean,
  IsEmail,
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
  Projet,
} from '@crm/database';

import {
  COMMENT_MAX_LENGTH,
  DUREE_ETABLISSEMENT_MAX_MOIS,
  EMAIL_MAX_LENGTH,
} from './attempt-rules.js';
import { MAX_SPREAD_DAYS, MIN_SPREAD_DAYS } from './distribution.js';
import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';

export class CreateCampaignDto {
  @ApiProperty({ maxLength: 120, example: 'Campagne CHUES, avril' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: Projet, enumName: 'Projet', default: Projet.CHUES })
  @IsOptional()
  @IsEnum(Projet)
  projet?: Projet;

  @ApiProperty({
    enum: CampaignScope,
    enumName: 'CampaignScope',
    description:
      'Périmètre du tirage. BDD1..BDD4 sont les segments partagés ; ALL réunit les quatre sans recouvrement.',
  })
  @IsEnum(CampaignScope)
  scope!: CampaignScope;

  @ApiPropertyOptional({ format: 'uuid', description: 'Offre ciblée, pour Grand Public.' })
  @IsOptional()
  @IsUUID()
  offerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  canalProvenanceId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  professionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  incomeBandId?: string;

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
    type: Number,
    minimum: MIN_SPREAD_DAYS,
    maximum: MAX_SPREAD_DAYS,
    default: MIN_SPREAD_DAYS,
    description:
      'Étale la file de chaque commercial sur N journées. À 1 (défaut), comportement inchangé : un seul programme. Au-delà, chaque commercial reçoit un programme par jour, ce qui rend une base de 120 000 fiches distribuable.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_SPREAD_DAYS)
  @Max(MAX_SPREAD_DAYS)
  spreadDays?: number;
}

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

  @ApiProperty({ type: () => [Number], description: 'Lignes par journée, jour 1 en tête.' })
  perDay!: number[];
}

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

  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: Boolean, nullable: true }) fonctionnaire!: boolean | null;
  @ApiProperty({ type: Boolean, nullable: true }) engagementEnCours!: boolean | null;
  @ApiProperty({ type: Number, nullable: true }) dureeEtablissementMois!: number | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Non nulle si et seulement si method vaut APPOINTMENT.',
  })
  rendezVousAt!: string | null;

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

export class CallRecordingDto {
  @ApiProperty({ format: 'uuid' }) attemptId!: string;
  @ApiProperty({ type: Number }) bytes!: number;
}

export class CampaignSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: Projet, enumName: 'Projet' }) projet!: Projet;
  @ApiProperty({ enum: CampaignScope, enumName: 'CampaignScope' }) scope!: CampaignScope;
  @ApiProperty({ description: 'Libellé lisible du périmètre, issu de la définition partagée.' })
  scopeLabel!: string;
  @ApiProperty({ enum: CampaignStatus, enumName: 'CampaignStatus' }) status!: CampaignStatus;
  @ApiProperty({ type: String, nullable: true }) offerLabel!: string | null;

  @ApiProperty({
    description:
      'Graine du tirage, persistée pour pouvoir rejouer et auditer la répartition. Les affectations, elles, sont matérialisées.',
  })
  seed!: string;

  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty() createdByName!: string;
  @ApiProperty({ type: Number }) commercialCount!: number;

  @ApiProperty({ type: Number, description: 'Journées d’étalement. 1 : programme unique.' })
  spreadDays!: number;

  @ApiProperty({ type: () => CampaignProgressDto }) progress!: CampaignProgressDto;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) closedAt!: string | null;
}

export class CampaignDetailDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: Projet, enumName: 'Projet' }) projet!: Projet;
  @ApiProperty({ enum: CampaignScope, enumName: 'CampaignScope' }) scope!: CampaignScope;
  @ApiProperty() scopeLabel!: string;
  @ApiProperty({ enum: CampaignStatus, enumName: 'CampaignStatus' }) status!: CampaignStatus;
  @ApiProperty({ type: String, nullable: true }) offerLabel!: string | null;
  @ApiProperty() seed!: string;
  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty() createdByName!: string;
  @ApiProperty({ type: Number }) commercialCount!: number;

  @ApiProperty({ type: Number, description: 'Journées d’étalement. 1 : programme unique.' })
  spreadDays!: number;

  @ApiProperty({ type: () => CampaignProgressDto }) progress!: CampaignProgressDto;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) closedAt!: string | null;

  @ApiProperty({
    type: () => [Number],
    description: 'Lignes par journée, toutes affectations confondues. Jour 1 en tête.',
  })
  perDay!: number[];

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
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export class CampaignQueryDto {
  @ApiPropertyOptional({ enum: Projet, enumName: 'Projet' })
  @IsOptional()
  @IsEnum(Projet)
  projet?: Projet;
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

  @ApiPropertyOptional({
    enum: CampaignScope,
    enumName: 'CampaignScope',
    description: 'Périmètre du tirage.',
  })
  @IsOptional()
  @IsEnum(CampaignScope)
  scope?: CampaignScope;

  @ApiPropertyOptional({ format: 'uuid', description: 'Administrateur qui a créé la campagne.' })
  @IsOptional()
  @IsUUID()
  createdById?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne basse sur la date de création, incluse.',
  })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne haute sur la date de création, incluse.',
  })
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

export class ProgrammeQueryDto {
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

export class Phase2ConflictDto {
  @ApiProperty({ enum: ['PHASE2_ALREADY_COMPLETED'] }) code!: 'PHASE2_ALREADY_COMPLETED';
  @ApiProperty() message!: string;
  @ApiProperty({ type: () => ProspectPhase2StateDto }) state!: ProspectPhase2StateDto;
}
