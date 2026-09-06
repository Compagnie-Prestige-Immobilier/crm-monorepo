import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import {
  IsBoolean,
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
} from 'class-validator';
import {
  BddSegment,
  CallOutcome,
  ChangeSource,
  EnrollmentMethod,
  GrandPublicConsent,
  ModeEpargne,
  PaymentMode,
  Phase2Status,
  Projet,
  ProspectStatut,
  ProspectType,
  TypeContrat,
  WhatsappStatus,
} from '@crm/database';

import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';

/** Plafond du type `Int` de PostgreSQL, en FCFA. */
const MONTANT_MAX_XOF = 2_147_483_647;

/** 70 ans de carrière : au-delà, c'est une saisie en années prise pour des mois. */
export const ANCIENNETE_MAX_MOIS = 840;

export class CreateProspectDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Identifiant UUID v7 généré par le client. Généré côté serveur s’il est absent.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nom!: string;

  /**
   * Facultatif, comme tout le reste sauf le nom et le téléphone.
   *
   * La colonne reste NOT NULL : un prénom absent s'enregistre en chaîne vide,
   * ce que les écrans savent déjà rendre. La rendre nullable ferait porter à
   * tout le code la distinction entre « pas de prénom » et « prénom vide »,
   * pour une différence qu'aucun métier ne fait ici.
   */
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  prenom?: string;

  @ApiProperty({
    maxLength: 40,
    description: 'Téléphone en saisie libre. Normalisé en E.164 par le serveur.',
    example: '77 123 45 67',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone!: string;

  /**
   * FACULTATIFS, et c'est le point.
   *
   * Un téléconseiller au téléphone n'obtient pas toujours la banque ni le
   * syndicat, et un champ requis lui faisait abandonner la fiche entière. Une
   * fiche Grand Public n'en a simplement aucun : elle ne passe par aucun
   * représentant et ne relève d'aucun syndicat.
   */
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
  representantId?: string;

  @ApiPropertyOptional({
    enum: Projet,
    enumName: 'Projet',
    description: 'CHUES par défaut. Les deux projets ne se mélangent nulle part.',
  })
  @IsOptional()
  @IsEnum(Projet)
  projet?: Projet;

  @ApiPropertyOptional({ enum: ProspectType, enumName: 'ProspectType' })
  @IsOptional()
  @IsEnum(ProspectType)
  type?: ProspectType;

  @ApiPropertyOptional({ maxLength: 120, description: 'Métier déclaré, en clair.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Profession choisie dans le référentiel.' })
  @IsOptional()
  @IsUUID()
  professionId?: string;

  @ApiPropertyOptional({ maxLength: 160, description: 'Établissement où le prospect exerce.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  etablissement?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Tranche de revenu mensuel déclaré.' })
  @IsOptional()
  @IsUUID()
  incomeBandId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Employeur du référentiel : ministère (fonctionnaire) ou entreprise (privé).',
  })
  @IsOptional()
  @IsUUID()
  employeurId?: string;

  @ApiPropertyOptional({ maxLength: 160, description: 'Employeur en clair, si hors référentiel.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  employeur?: string;

  @ApiPropertyOptional({
    enum: TypeContrat,
    enumName: 'TypeContrat',
    description: 'Secteur privé : nature du contrat.',
  })
  @IsOptional()
  @IsEnum(TypeContrat)
  typeContrat?: TypeContrat;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: ANCIENNETE_MAX_MOIS,
    description: 'Ancienneté chez l’employeur, en MOIS. Distincte de `dureeSystemeMois`.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(ANCIENNETE_MAX_MOIS)
  ancienneteMois?: number;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Informel : marché, quartier ou lieu d’activité.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  lieuActivite?: string;

  @ApiPropertyOptional({ enum: ModeEpargne, enumName: 'ModeEpargne' })
  @IsOptional()
  @IsEnum(ModeEpargne)
  modeEpargne?: ModeEpargne;

  @ApiPropertyOptional({ format: 'uuid', description: 'Diaspora : pays de résidence.' })
  @IsOptional()
  @IsUUID()
  paysResidenceId?: string;

  @ApiPropertyOptional({ maxLength: 120, description: 'Diaspora : ville de résidence.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  villeResidence?: string;

  @ApiPropertyOptional({
    maxLength: 40,
    description:
      'Numéro WhatsApp, souvent international et distinct du numéro principal. ' +
      'Saisie libre, normalisé en E.164 par le serveur.',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  whatsappE164?: string;

  @ApiPropertyOptional({ maxLength: 160, description: 'Diaspora : personne relais au Sénégal.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  relaisNom?: string;

  @ApiPropertyOptional({
    maxLength: 40,
    description: 'Téléphone du relais. Saisie libre, normalisé en E.164 par le serveur.',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  relaisPhoneE164?: string;

  @ApiPropertyOptional({ enum: PaymentMode, enumName: 'PaymentMode' })
  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 300,
    description: 'Durée du système de paiement, en MOIS.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  dureeSystemeMois?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Canal de provenance, choisi dans le référentiel.',
  })
  @IsOptional()
  @IsUUID()
  canalProvenanceId?: string;

  @ApiPropertyOptional({ enum: ProspectStatut, enumName: 'ProspectStatut' })
  @IsOptional()
  @IsEnum(ProspectStatut)
  statut?: ProspectStatut;

  @ApiPropertyOptional({ format: 'date-time', description: 'Horodatage de la saisie terrain.' })
  @IsOptional()
  @IsISO8601()
  clientCreatedAt?: string;
}

/** Champs qu'un PATCH peut VIDER. Redéclarés plus bas, `null` compris. */
const EFFACABLES = [
  'banqueId',
  'syndicatId',
  'professionId',
  'incomeBandId',
  'canalProvenanceId',
  'employeurId',
  'employeur',
  'typeContrat',
  'ancienneteMois',
  'lieuActivite',
  'modeEpargne',
  'paysResidenceId',
  'villeResidence',
  'etablissement',
  'whatsappE164',
  'relaisNom',
  'relaisPhoneE164',
] as const;

/**
 * Corriger une fiche, c'est aussi effacer ce qu'on y avait mis par erreur.
 *
 * Hérités de la création, ces champs ne descendaient qu'en `string` dans les
 * clients générés : le web ne pouvait pas envoyer le `null` que le service
 * écrit pourtant déjà. `OmitType` les retire avant de les redéclarer nullables,
 * sinon la redéclaration ne serait pas assignable au type du parent.
 */
export class UpdateProspectDto extends PartialType(OmitType(CreateProspectDto, EFFACABLES)) {
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  banqueId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  syndicatId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  professionId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  incomeBandId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  canalProvenanceId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  employeurId?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 160, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  employeur?: string | null;

  @ApiPropertyOptional({ enum: TypeContrat, enumName: 'TypeContrat', nullable: true })
  @IsOptional()
  @IsEnum(TypeContrat)
  typeContrat?: TypeContrat | null;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: ANCIENNETE_MAX_MOIS,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(ANCIENNETE_MAX_MOIS)
  ancienneteMois?: number | null;

  @ApiPropertyOptional({ type: String, maxLength: 160, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  lieuActivite?: string | null;

  @ApiPropertyOptional({ enum: ModeEpargne, enumName: 'ModeEpargne', nullable: true })
  @IsOptional()
  @IsEnum(ModeEpargne)
  modeEpargne?: ModeEpargne | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  paysResidenceId?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 120, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  villeResidence?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 160, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  etablissement?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 40, nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  whatsappE164?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 160, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  relaisNom?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 40, nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  relaisPhoneE164?: string | null;
}

export class ProspectDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nom!: string;
  @ApiProperty() prenom!: string;
  @ApiProperty() phoneE164!: string;
  @ApiProperty({ type: Number }) rev!: number;
  @ApiProperty({ enum: ProspectStatut, enumName: 'ProspectStatut' }) statut!: ProspectStatut;
  @ApiProperty({ enum: Projet, enumName: 'Projet' }) projet!: Projet;

  /**
   * Nuls sur une fiche Grand Public, et nuls sur une fiche CHUES dont le
   * téléconseiller n'a pas obtenu la réponse. Le panneau doit rendre l'absence,
   * pas la remplacer par un tiret qui se lirait comme une valeur.
   */
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) banqueId!: string | null;
  @ApiProperty({ type: String, nullable: true }) banqueName!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) syndicatId!: string | null;
  @ApiProperty({ type: String, nullable: true }) syndicatSigle!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) representantId!: string | null;
  @ApiProperty({ type: String, nullable: true }) representantName!: string | null;
  @ApiProperty({ type: String, nullable: true }) representantPhoneE164!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) departementId!: string | null;
  @ApiProperty({ type: String, nullable: true }) departementName!: string | null;
  @ApiProperty({ format: 'uuid' }) ownedByCommercialId!: string;
  @ApiProperty() ownedByCommercialName!: string;

  @ApiProperty({
    enum: ProspectType,
    enumName: 'ProspectType',
    nullable: true,
    description: 'Hors CHUES : ce qu’est le prospect. Nul si la question n’a pas été posée.',
  })
  type!: ProspectType | null;

  @ApiProperty({ type: String, nullable: true, description: 'Métier déclaré, en clair.' })
  profession!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) professionId!: string | null;
  @ApiProperty({ type: Boolean, nullable: true }) professionIsTeaching!: boolean | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) incomeBandId!: string | null;
  @ApiProperty({ type: String, nullable: true }) incomeBandLabel!: string | null;
  @ApiProperty({ enum: PaymentMode, enumName: 'PaymentMode', nullable: true })
  paymentMode!: PaymentMode | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true }) employeurId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Libellé du référentiel, ou l’employeur saisi en clair à défaut.',
  })
  employeur!: string | null;

  @ApiProperty({ enum: TypeContrat, enumName: 'TypeContrat', nullable: true })
  typeContrat!: TypeContrat | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Ancienneté chez l’employeur, en MOIS.',
  })
  ancienneteMois!: number | null;

  @ApiProperty({ type: String, nullable: true }) lieuActivite!: string | null;

  @ApiProperty({ enum: ModeEpargne, enumName: 'ModeEpargne', nullable: true })
  modeEpargne!: ModeEpargne | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true }) paysResidenceId!: string | null;
  @ApiProperty({ type: String, nullable: true }) paysResidenceLabel!: string | null;
  @ApiProperty({ type: String, nullable: true }) villeResidence!: string | null;
  @ApiProperty({ type: String, nullable: true }) etablissement!: string | null;

  @ApiProperty({ enum: WhatsappStatus, enumName: 'WhatsappStatus' })
  whatsappStatus!: WhatsappStatus;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Renseigné avec le seul statut AUTRE_NUMERO.',
  })
  whatsappE164!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Numéro joignable sur WhatsApp, recomposé : `phoneE164` sur MEME_NUMERO, `whatsappE164` sur AUTRE_NUMERO, nul sinon.',
  })
  whatsappNumber!: string | null;
  @ApiProperty({ type: String, nullable: true }) relaisNom!: string | null;
  @ApiProperty({ type: String, nullable: true }) relaisPhoneE164!: string | null;

  @ApiProperty({ type: () => [ProspectJourneyDto] })
  journeys!: ProspectJourneyDto[];

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Durée du système de paiement retenue, en MOIS.',
  })
  dureeSystemeMois!: number | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  canalProvenanceId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Par où le prospect est arrivé. Référentiel ouvert.',
  })
  canalProvenanceLabel!: string | null;

  @ApiProperty({
    enum: BddSegment,
    enumName: 'BddSegment',
    nullable: true,
    description:
      'Calculé par croisement syndicat × banque, jamais stocké. NUL dès qu’il manque l’un des deux : le segment ne se devine pas.',
  })
  segment!: BddSegment | null;

  @ApiProperty({ enum: Phase2Status, enumName: 'Phase2Status' }) phase2Status!: Phase2Status;

  @ApiProperty({
    enum: EnrollmentMethod,
    enumName: 'EnrollmentMethod',
    nullable: true,
    description: 'Renseignée si et seulement si `phase2Status` vaut METHOD_OBTAINED.',
  })
  enrollmentMethod!: EnrollmentMethod | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Commercial ayant OBTENU la méthode, distinct de `ownedByCommercialId` qui a fait la saisie de phase 1.',
  })
  enrollmentCapturedById!: string | null;

  @ApiProperty({ type: String, nullable: true }) enrollmentCapturedByName!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  enrollmentCapturedAt!: string | null;

  @ApiProperty({
    enum: CallOutcome,
    enumName: 'CallOutcome',
    nullable: true,
    description: 'Résultat de la dernière tentative d’appel enregistrée.',
  })
  lastOutcome!: CallOutcome | null;

  @ApiProperty({ type: String, nullable: true, description: 'Commentaire de cette tentative.' })
  lastComment!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastAttemptAt!: string | null;

  @ApiProperty({ type: Number, description: 'Nombre de tentatives d’appel consignées.' })
  callAttemptCount!: number;

  /**
   * Le dernier appel PORTÉ PAR LA FICHE, et non recalculé sur les tentatives :
   * c'est lui qui descend au téléphone et qui filtre « mes contacts ».
   */
  @ApiProperty({ enum: CallOutcome, enumName: 'CallOutcome', nullable: true })
  lastCallOutcome!: CallOutcome | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastCallAt!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  lastCallById!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastCallByName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Clé de provenance. Nulle pour une fiche née d’une tournée terrain.',
  })
  origin!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Détail conservé à la création (nom de la banque demandeuse, par exemple).',
  })
  originLabel!: string | null;

  @ApiProperty({ type: String, format: 'date-time' }) clientCreatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) deletedAt!: string | null;
}

export class ProspectJourneyDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: Projet, enumName: 'Projet' }) projet!: Projet;
  @ApiProperty({ enum: ProspectStatut, enumName: 'ProspectStatut' }) statut!: ProspectStatut;
  @ApiProperty({ enum: GrandPublicConsent, enumName: 'GrandPublicConsent' })
  consent!: GrandPublicConsent;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) consentAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) convertedAt!: string | null;
}

export class UpdateGrandPublicConsentDto {
  @ApiProperty({ enum: GrandPublicConsent, enumName: 'GrandPublicConsent' })
  @IsEnum(GrandPublicConsent)
  consent!: GrandPublicConsent;
}

export class ConfirmGrandPublicConversionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  offerId!: string;

  @ApiPropertyOptional({ enum: PaymentMode, enumName: 'PaymentMode' })
  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  /**
   * La colonne est un `Int` PostgreSQL : au-delà de 2 147 483 647 FCFA, la base
   * répond « integer out of range » et l'appelant reçoit un 500 non qualifié
   * sur une valeur que la validation venait d'accepter. La borne dit la vraie
   * limite plutôt que de la laisser découvrir par un plantage.
   */
  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: MONTANT_MAX_XOF })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MONTANT_MAX_XOF)
  amountXof?: number;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 300 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  durationMonths?: number;
}

/** Une tentative d'appel, avec ce que l'appel a appris ce jour-là. */
export class ProspectCallAttemptDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: CallOutcome, enumName: 'CallOutcome' }) outcome!: CallOutcome;
  @ApiProperty({ type: String, nullable: true, description: 'Libellé du motif choisi.' })
  reasonLabel!: string | null;
  @ApiProperty({ enum: EnrollmentMethod, enumName: 'EnrollmentMethod', nullable: true })
  method!: EnrollmentMethod | null;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: Boolean, nullable: true }) fonctionnaire!: boolean | null;
  @ApiProperty({ type: Boolean, nullable: true }) engagementEnCours!: boolean | null;
  @ApiProperty({ type: Number, nullable: true }) dureeEtablissementMois!: number | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) rendezVousAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) deviceCallType!: string | null;
  @ApiProperty({ type: Number, nullable: true }) deviceCallDurationSeconds!: number | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) deviceCallAt!: string | null;
  @ApiProperty({ format: 'uuid' }) performedById!: string;
  @ApiProperty() performedByName!: string;
  @ApiProperty({ type: String, format: 'date-time' }) clientCreatedAt!: string;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Temps de traitement de la fiche pour cet appel, en secondes : de la première saisie à la qualification. Nul quand l’appel a été consigné hors du parcours de fiche ouverte, ou sans aucune saisie. Distinct de `deviceCallDurationSeconds`, qui est la durée de communication.',
  })
  dureeTraitementSecondes!: number | null;
}

export class ProspectCallAttemptListDto {
  @ApiProperty({
    type: () => [ProspectCallAttemptDto],
    description: 'Du plus récent au plus ancien.',
  })
  items!: ProspectCallAttemptDto[];
}

export class ProspectListDto {
  @ApiProperty({ type: () => [ProspectDto] }) items!: ProspectDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export class ProspectConflictExistingDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nom!: string;
  @ApiProperty() prenom!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) representantId!: string | null;
  @ApiProperty({ type: String, nullable: true }) representantName!: string | null;
  @ApiProperty({ format: 'uuid' }) ownedByCommercialId!: string;
  @ApiProperty() ownedByCommercialName!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class ProspectConflictDto extends ApiErrorDto {
  @ApiProperty({ enum: ['PROSPECT_PHONE_CONFLICT'] })
  declare code: 'PROSPECT_PHONE_CONFLICT';

  @ApiProperty({ type: () => ProspectConflictExistingDto })
  existing!: ProspectConflictExistingDto;
}

export class MergeProspectsDto {
  @ApiProperty({ format: 'uuid', description: 'La fiche conservée.' })
  @IsUUID()
  targetId!: string;

  @ApiProperty({ format: 'uuid', description: 'La fiche absorbée puis supprimée logiquement.' })
  @IsUUID()
  sourceId!: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      'Reprendre les champs de la source (nom, prénom, banque, syndicat, statut) sur la cible.',
  })
  @IsOptional()
  @IsBoolean()
  preferSource?: boolean;
}

export class ReassignProspectsDto {
  @ApiProperty({
    type: () => [String],
    description: 'Identifiants des prospects à réaffecter.',
  })
  @IsUUID('all', { each: true })
  prospectIds!: string[];

  @ApiPropertyOptional({ format: 'uuid', description: 'Nouveau représentant de rattachement.' })
  @IsOptional()
  @IsUUID()
  representantId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Nouveau commercial propriétaire. Réservé à l’ADMIN.',
  })
  @IsOptional()
  @IsUUID()
  commercialId?: string;
}

export class ReassignResultDto {
  @ApiProperty({ type: Number }) updated!: number;
  @ApiProperty({ type: () => [String], description: 'Identifiants effectivement réaffectés.' })
  prospectIds!: string[];
}

export class ChangeProspectSegmentDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Nouvelle banque. Omise, la banque courante est conservée.',
  })
  @IsOptional()
  @IsUUID()
  banqueId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Nouveau syndicat. Omis, le syndicat courant est conservé.',
  })
  @IsOptional()
  @IsUUID()
  syndicatId?: string;

  @ApiProperty({
    minLength: 5,
    maxLength: 500,
    description: 'Motif en clair. Une bascule de segment n’est pas une correction de saisie.',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @ApiProperty({
    type: Number,
    minimum: 1,
    description:
      'Révision attendue. Un écart renvoie PROSPECT_REV_CONFLICT avec la révision réelle.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRev!: number;
}

export class SegmentChangeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) prospectId!: string;

  @ApiProperty({ enum: BddSegment, enumName: 'BddSegment' }) fromSegment!: BddSegment;
  @ApiProperty({ enum: BddSegment, enumName: 'BddSegment' }) toSegment!: BddSegment;

  @ApiProperty({ format: 'uuid' }) fromBanqueId!: string;
  @ApiProperty({ format: 'uuid' }) toBanqueId!: string;
  @ApiProperty({ format: 'uuid' }) fromSyndicatId!: string;
  @ApiProperty({ format: 'uuid' }) toSyndicatId!: string;

  @ApiProperty({ type: String, nullable: true }) reason!: string | null;

  @ApiProperty({ format: 'uuid' }) changedById!: string;
  @ApiProperty() changedByName!: string;

  @ApiProperty({
    enum: ChangeSource,
    enumName: 'ChangeSource',
    description: 'Le canal qui a écrit la bascule. Le panel écrit WEB.',
  })
  source!: ChangeSource;

  @ApiProperty({ type: String, format: 'date-time' }) changedAt!: string;
}

export class SegmentChangeListDto {
  @ApiProperty({
    type: () => [SegmentChangeDto],
    description: 'De la plus récente à la plus ancienne.',
  })
  items!: SegmentChangeDto[];
}
