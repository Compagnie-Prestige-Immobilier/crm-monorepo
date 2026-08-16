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

  /**
   * Provenance de la fiche, telle qu'elle est STOCKÉE et indexée.
   *
   * Sans ces deux champs, un client qui vient de faire approuver une demande de
   * création ne peut pas relire d'où vient la fiche qu'il a obtenue : il la
   * voit identique à une fiche de tournée terrain, alors que la base sait la
   * distinguer et que le tableau de bord la compte à part.
   */
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

/**
 * Le conflit de numéro, qui est une erreur ENRICHIE.
 *
 * Il hérite d'`ApiErrorDto` plutôt que de redéclarer sa moitié : le filtre
 * global complète toute erreur avec `statusCode` et `requestId`, si bien qu'un
 * schéma qui ne déclarait que `code` et `message` promettait moins que ce que
 * le serveur envoie réellement. Un client généré sur ce schéma ne pouvait pas
 * lire `statusCode` sur cette réponse et sur aucune autre.
 *
 * Ce qu'il ajoute, `existing`, est la raison d'être du schéma : le corps porte
 * la fiche déjà enregistrée pour que l'écran propose de l'ouvrir au lieu de
 * dire seulement « ce numéro existe déjà ».
 */
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

/**
 * Migration de segment : ce que le panel envoie pour faire basculer une fiche.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UNE OPÉRATION À PART, ALORS QUE `PATCH /prospects/:id` SAIT DÉJÀ
 * ÉCRIRE CES DEUX CLÉS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le segment n'est pas stocké : il se calcule en croisant le syndicat et la
 * banque. Changer ces deux clés par la modification ordinaire fait donc
 * basculer la fiche de BDD3 à BDD1 sans laisser la moindre trace, et plus rien
 * ensuite ne distingue une fiche CONVERTIE d'une fiche née en BDD1.
 *
 * Or convertir est le métier. Cette opération existe pour que la bascule soit
 * un ACTE : elle exige un motif, elle écrit `SegmentChange` dans la même
 * transaction que la fiche, et elle refuse de s'exécuter à vide.
 */
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

  /**
   * OBLIGATOIRE, et c'est la moitié de l'intérêt de la table.
   *
   * « Combien de BDD3 avons-nous fait basculer ce mois » se répond avec des
   * dates et des segments ; « pourquoi celle-ci » ne se répond qu'avec une
   * phrase écrite par la personne qui a cliqué, au moment où elle savait
   * encore.
   */
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

/**
 * Une bascule déjà écrite.
 *
 * Les deux segments sont RELUS en base et jamais recalculés à l'affichage : la
 * fonction de segmentation peut changer, l'histoire non. Une fiche convertie
 * vers BDD1 le restera même si la définition de l'axe CBAO évolue.
 */
export class SegmentChangeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) prospectId!: string;

  @ApiProperty({ enum: BddSegment, enumName: 'BddSegment' }) fromSegment!: BddSegment;
  @ApiProperty({ enum: BddSegment, enumName: 'BddSegment' }) toSegment!: BddSegment;

  /*
   * Les quatre clés sont rendues NUES, sans nom de banque ni sigle de
   * syndicat. `SegmentChange` ne porte aucune relation vers les référentiels,
   * c'est délibéré côté schéma : l'histoire ne doit pas empêcher de retirer une
   * banque du référentiel. Les résoudre ici demanderait une lecture de plus
   * pour afficher ce que les deux segments disent déjà.
   */
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
