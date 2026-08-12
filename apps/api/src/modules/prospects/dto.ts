import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  BddSegment,
  CallOutcome,
  EnrollmentMethod,
  Phase2Status,
  ProspectStatut,
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

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  prenom!: string;

  @ApiProperty({
    maxLength: 40,
    description: 'Téléphone en saisie libre. Normalisé en E.164 par le serveur.',
    example: '77 123 45 67',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  banqueId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  syndicatId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  representantId!: string;

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
  @ApiProperty({ format: 'uuid' }) banqueId!: string;
  @ApiProperty() banqueName!: string;
  @ApiProperty({ format: 'uuid' }) syndicatId!: string;
  @ApiProperty() syndicatSigle!: string;
  @ApiProperty({ format: 'uuid' }) representantId!: string;
  @ApiProperty() representantName!: string;
  @ApiProperty() representantPhoneE164!: string;
  @ApiProperty({ format: 'uuid' }) departementId!: string;
  @ApiProperty() departementName!: string;
  @ApiProperty({ format: 'uuid' }) ownedByCommercialId!: string;
  @ApiProperty() ownedByCommercialName!: string;

  /**
   * Segment CALCULÉ à chaque lecture par `classifySegment`, jamais stocké.
   *
   * Une colonne dénormalisée dériverait dès la première correction de banque
   * faite depuis le panel : la fiche resterait affichée en BDD1 alors qu'elle
   * appartient désormais à BDD2, et l'écart ne se verrait qu'au moment où
   * quelqu'un recouperait un export avec un graphique.
   */
  @ApiProperty({
    enum: BddSegment,
    enumName: 'BddSegment',
    description: 'Calculé par croisement syndicat × banque. Jamais stocké en base.',
  })
  segment!: BddSegment;

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

  @ApiProperty({ type: String, format: 'date-time' }) clientCreatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) deletedAt!: string | null;
}

export class ProspectListDto {
  @ApiProperty({ type: () => [ProspectDto] }) items!: ProspectDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

/**
 * Fiche déjà en base qui occupe le numéro.
 *
 * Elle nomme le commercial propriétaire : sans ce nom, le mobile ne peut
 * afficher qu'« ce numéro existe déjà », et le commercial sur le terrain n'a
 * aucun moyen de savoir à qui parler pour débloquer la situation.
 */
export class ProspectConflictExistingDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nom!: string;
  @ApiProperty() prenom!: string;
  @ApiProperty({ format: 'uuid' }) representantId!: string;
  @ApiProperty() representantName!: string;
  @ApiProperty({ format: 'uuid' }) ownedByCommercialId!: string;
  @ApiProperty() ownedByCommercialName!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class ProspectConflictDto {
  @ApiProperty({ enum: ['PROSPECT_PHONE_CONFLICT'] })
  code!: 'PROSPECT_PHONE_CONFLICT';

  @ApiProperty() message!: string;

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
