import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
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
  Phase2Status,
  Projet,
  ProspectStatut,
  ProspectType,
} from '@crm/database';

import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';

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

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 600,
    description: 'Durée du système de paiement, en MOIS.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  dureeSystemeMois?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Canal de provenance, choisi dans le référentiel.' })
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

export class UpdateProspectDto extends PartialType(CreateProspectDto) {}

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
