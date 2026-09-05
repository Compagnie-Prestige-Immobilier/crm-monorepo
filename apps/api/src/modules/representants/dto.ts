import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
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
import {
  ChangeSource,
  RappelOrigine,
  RepCallOutcome,
  RepresentantRelation,
  StatutQualificationEffect,
  WhatsappStatus,
} from '@crm/database';

import { PageMetaDto, SortOrder } from '../../common/dto/prospect-filter.dto.js';
import { queryBoolean } from '../../common/dto/query-boolean.js';

export const PROFESSION_MAX_LENGTH = 120;

export class CreateRepresentantDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Identifiant UUID v7 généré par le client. Fourni par le mobile pour que les prospects saisis hors ligne puissent le référencer avant toute synchronisation.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Prénom, quand il a été recueilli séparément du nom complet.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  prenom?: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description: 'Établissement où il exerce. Ni l’IEF ni le département.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  etablissement?: string;

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
  departementId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'IEF de rattachement. FACULTATIVE : les fiches saisies avant l’arrivée de ' +
      'ce référentiel n’en portent pas, et la rendre obligatoire les invaliderait ' +
      'rétroactivement. Le département reste obligatoire, il se déduit de l’IEF, ' +
      'jamais l’inverse.',
  })
  @IsOptional()
  @IsUUID()
  iefId?: string;

  @ApiPropertyOptional({ type: String, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Horodatage de la saisie sur le terrain. Défaut : maintenant. Distinct de createdAt, qui est l’arrivée en base.',
  })
  @IsOptional()
  @IsISO8601()
  clientCreatedAt?: string;
}

export class UpdateRepresentantDto extends PartialType(CreateRepresentantDto) {
  @ApiPropertyOptional({
    enum: RepresentantRelation,
    enumName: 'RepresentantRelation',
    description:
      'État de la relation. Chaque bascule est historisée ; reposter le même statut n’écrit rien.',
  })
  @IsOptional()
  @IsEnum(RepresentantRelation)
  relationStatus?: RepresentantRelation;

  @ApiPropertyOptional({
    type: String,
    maxLength: 500,
    description:
      'Motif de la bascule, repris dans la chronologie. Sans effet quand `relationStatus` est absent ou reposte le statut courant.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  relationReason?: string;

  @ApiPropertyOptional({
    enum: WhatsappStatus,
    enumName: 'WhatsappStatus',
    description:
      'Trois états et non un booléen : NON_DEMANDE dit que la question n’a pas été posée, AUCUN qu’elle l’a été et que la réponse est non.',
  })
  @IsOptional()
  @IsEnum(WhatsappStatus)
  whatsappStatus?: WhatsappStatus;

  @ApiPropertyOptional({
    type: String,
    minLength: 6,
    maxLength: 40,
    description:
      'Numéro WhatsApp DISTINCT du téléphone. Saisie libre, normalisé par le serveur. Admis avec le seul statut AUTRE_NUMERO : sur MEME_NUMERO le numéro se relit sur `phoneE164`.',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  whatsappE164?: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: PROFESSION_MAX_LENGTH,
    description: 'Profession, en texte libre. Chaîne vide : la valeur est effacée.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(PROFESSION_MAX_LENGTH)
  profession?: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: 200,
    description:
      'Niveau de syndicat déclaré pendant la qualification. Texte libre, distinct du référentiel Syndicat des prospects. Chaîne vide : la valeur est effacée.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  syndicat?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Le représentant déclare connaître l’UES.',
  })
  @IsOptional()
  @IsBoolean()
  connaitUES?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Le représentant déclare avoir déjà été contacté. Distinct de relationStatus, qui porte la décision ambassadeur/refus.',
  })
  @IsOptional()
  @IsBoolean()
  contacte?: boolean;
}

export class RepresentantDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ description: 'Téléphone normalisé E.164.' }) phoneE164!: string;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ type: Number, description: 'Révision serveur, incrémentée à chaque écriture.' })
  rev!: number;
  @ApiProperty({ format: 'uuid' }) departementId!: string;
  @ApiProperty() departementName!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) iefId!: string | null;
  @ApiProperty({ type: String, nullable: true }) iefName!: string | null;
  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty() createdByName!: string;
  @ApiProperty({ type: String, format: 'date-time' }) clientCreatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: Number }) prospectCount!: number;
  @ApiProperty({ enum: RepresentantRelation, enumName: 'RepresentantRelation' })
  relationStatus!: RepresentantRelation;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  statutQualificationId!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Libellé du statut de qualification, affiché à la place de `relationStatus`. Nul sur une fiche jamais qualifiée.',
  })
  statutQualificationLabel!: string | null;
  @ApiProperty({
    enum: StatutQualificationEffect,
    enumName: 'StatutQualificationEffect',
    nullable: true,
    description: 'Effet du statut : c’est lui qui colore la pastille.',
  })
  statutQualificationEffect!: StatutQualificationEffect | null;

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

  @ApiProperty({ type: String, nullable: true }) profession!: string | null;

  @ApiProperty({ type: String, nullable: true }) prenom!: string | null;
  @ApiProperty({ type: String, nullable: true }) etablissement!: string | null;
  @ApiProperty({ type: String, nullable: true }) syndicat!: string | null;
  @ApiProperty({ type: Boolean, nullable: true }) connaitUES!: boolean | null;
  @ApiProperty({ type: Boolean, nullable: true }) contacte!: boolean | null;

  @ApiProperty({
    enum: RepCallOutcome,
    enumName: 'RepCallOutcome',
    nullable: true,
    description: 'Issue du dernier appel. Nul : jamais appelé.',
  })
  lastCallOutcome!: RepCallOutcome | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastCallAt!: string | null;
  @ApiProperty({ type: Number, description: 'Nombre d’appels consignés sur cette fiche.' })
  callAttemptCount!: number;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) lastCallById!: string | null;
  @ApiProperty({ type: String, nullable: true }) lastCallByName!: string | null;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Rappel dû, tant qu’aucun appel ne l’a honoré.',
  })
  nextCallbackAt!: string | null;

  @ApiProperty({
    enum: RappelOrigine,
    enumName: 'RappelOrigine',
    nullable: true,
    description:
      'PROMIS : la date convenue avec la personne. AUTOMATIQUE : le délai de réessai du dernier statut non joint. Nul en même temps que `nextCallbackAt`.',
  })
  nextCallbackOrigine!: RappelOrigine | null;
}

export class RepresentantListDto {
  @ApiProperty({ type: () => [RepresentantDto] }) items!: RepresentantDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export enum RepresentantSortField {
  CLIENT_CREATED_AT = 'clientCreatedAt',
  CREATED_AT = 'createdAt',
  FULL_NAME = 'fullName',
  PROSPECTS = 'prospects',
  LAST_CALL_AT = 'lastCallAt',
  NEXT_CALLBACK_AT = 'nextCallbackAt',
  PRIORITE = 'priorite',
}

/** Ce que le dernier appel laisse à faire. */
export enum RepresentantSuivi {
  A_RAPPELER = 'A_RAPPELER',
  INJOIGNABLE = 'INJOIGNABLE',
}

export class RepresentantExportQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departementId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtre par IEF.' })
  @IsOptional()
  @IsUUID()
  iefId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Réservé à l’ADMIN.' })
  @IsOptional()
  @IsUUID()
  commercialId?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne basse sur la date de saisie terrain (clientCreatedAt), incluse.',
  })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne haute sur la date de saisie terrain (clientCreatedAt), incluse.',
  })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'true : au moins un prospect vivant. false : aucun (représentant dormant).',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  hasProspects?: boolean;

  @ApiPropertyOptional({ enum: RepresentantRelation, enumName: 'RepresentantRelation' })
  @IsOptional()
  @IsEnum(RepresentantRelation)
  relationStatus?: RepresentantRelation;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Statut de qualification du dernier appel. Sert le filtre de l’annuaire ET le tirage d’un lot d’appels.',
  })
  @IsOptional()
  @IsUUID()
  statutQualificationId?: string;

  @ApiPropertyOptional({ enum: WhatsappStatus, enumName: 'WhatsappStatus' })
  @IsOptional()
  @IsEnum(WhatsappStatus)
  whatsappStatus?: WhatsappStatus;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  hasWhatsapp?: boolean;

  @ApiPropertyOptional({
    enum: RepresentantSuivi,
    enumName: 'RepresentantSuivi',
    description:
      'A_RAPPELER : un rappel reste dû (`nextCallbackAt`), promis ou automatique, tri par défaut sur son échéance. INJOIGNABLE : le dernier appel n’a pas abouti, tri par défaut du plus récent au plus ancien.',
  })
  @IsOptional()
  @IsEnum(RepresentantSuivi)
  suivi?: RepresentantSuivi;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Qui a passé le dernier appel. Un téléconseiller y met son propre identifiant.',
  })
  @IsOptional()
  @IsUUID()
  lastCallById?: string;
}

const relationList = ({ value }: TransformFnParams): RepresentantRelation[] => {
  const brut: unknown[] = Array.isArray(value) ? value : String(value).split(',');
  return brut
    .map((part) => String(part).trim())
    .filter((part) => part !== '') as RepresentantRelation[];
};

/**
 * `relationStatus` accepte ici plusieurs états, séparés par des virgules. Il
 * reste unique sur l'export et les lots d'appels : une liste y élargirait le
 * périmètre qu'ils bornent.
 */
export class RepresentantQueryDto extends OmitType(RepresentantExportQueryDto, [
  'relationStatus',
] as const) {
  @ApiPropertyOptional({
    type: String,
    description:
      'Un ou plusieurs états de relation, séparés par des virgules. `CONTACTE,AMBASSADEUR,REFUS` rend tout ce qui a été contacté.',
    example: 'CONTACTE,AMBASSADEUR,REFUS',
  })
  @IsOptional()
  @Transform(relationList)
  @IsEnum(RepresentantRelation, { each: true })
  relationStatus?: RepresentantRelation[];

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'true : ne rend que ses propres fiches et celles qu’une campagne lui a confiées, quel que soit le rôle. L’écran d’appel le pose, l’annuaire non.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  mesFiches?: boolean;

  @ApiPropertyOptional({ enum: RepresentantSortField, enumName: 'RepresentantSortField' })
  @IsOptional()
  @IsEnum(RepresentantSortField)
  sortBy?: RepresentantSortField;

  @ApiPropertyOptional({ enum: SortOrder, enumName: 'SortOrder' })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

export class RepresentantLookupQueryDto {
  @ApiProperty({
    description: 'Téléphone en saisie libre ; normalisé avant recherche.',
    example: '77 123 45 67',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone!: string;
}

export class RepresentantLookupDto {
  @ApiProperty({ type: Boolean }) found!: boolean;

  @ApiProperty({ description: 'Le numéro tel que normalisé par le serveur.' })
  phoneE164!: string;

  @ApiProperty({ type: () => RepresentantDto, nullable: true })
  representant!: RepresentantDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Nom du commercial propriétaire de la fiche, pour que le mobile puisse dire à qui s’adresser.',
  })
  ownedByCommercialName!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  ownedByCommercialId!: string | null;
}

export class DeleteQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Supprimer aussi les prospects rattachés. Sinon la suppression est refusée.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  cascade?: boolean;
}

export class ImportRowErrorDto {
  @ApiProperty({ type: Number, description: 'Numéro de ligne dans le fichier, en-tête compris.' })
  line!: number;

  @ApiProperty({ description: 'Code stable du motif, pour que l’interface puisse le traduire.' })
  code!: string;

  @ApiProperty({ description: 'Motif lisible, prêt à afficher.' }) message!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Valeur fautive, telle que saisie.' })
  value!: string | null;
}

export class ImportRowPreviewDto {
  @ApiProperty({ type: Number }) line!: number;
  @ApiProperty() fullName!: string;
  @ApiProperty({ description: 'Téléphone normalisé E.164 par le serveur.' }) phoneE164!: string;
  @ApiProperty() departementName!: string;
  @ApiProperty({ type: String, nullable: true }) iefName!: string | null;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ type: String, nullable: true }) etablissement!: string | null;

  @ApiProperty({ enum: RepresentantRelation, enumName: 'RepresentantRelation' })
  relationStatus!: RepresentantRelation;

  @ApiProperty({ enum: WhatsappStatus, enumName: 'WhatsappStatus' })
  whatsappStatus!: WhatsappStatus;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date-time',
    description: 'Date de l’appel déjà passé que la ligne enregistrera, s’il y en a un.',
  })
  calledAt!: string | null;
}

export class ImportReportDto {
  @ApiProperty({
    type: Boolean,
    description:
      'Vrai si rien n’a été écrit. Le premier temps de l’import est TOUJOURS une simulation : appliquer 4 000 lignes sans les avoir vues ne se rattrape pas.',
  })
  dryRun!: boolean;

  @ApiProperty({ type: Number, description: 'Lignes de données lues, en-tête exclu.' })
  totalRows!: number;

  @ApiProperty({ type: Number, description: 'Lignes retenues.' }) valid!: number;

  @ApiProperty({
    type: Number,
    description:
      'Fiches déjà en base à qui le fichier apporte quelque chose. Nul quand `enrichir` est faux.',
  })
  enrichable!: number;

  @ApiProperty({
    type: Number,
    description: 'Fiches existantes réellement complétées. Nul en simulation.',
  })
  enriched!: number;
  @ApiProperty({ type: Number, description: 'Lignes rejetées.' }) rejected!: number;

  @ApiProperty({
    type: Number,
    description:
      'Doublons de téléphone : déjà en base, ou répétés à l’intérieur du fichier. Comptés dans `rejected`.',
  })
  duplicates!: number;

  @ApiProperty({
    type: Number,
    description: 'Représentants réellement créés. Toujours 0 en simulation.',
  })
  created!: number;

  @ApiProperty({ type: () => [ImportRowErrorDto], description: 'Au plus 200 erreurs détaillées.' })
  errors!: ImportRowErrorDto[];

  @ApiProperty({
    type: () => [ImportRowPreviewDto],
    description: 'Au plus 50 lignes valides, pour la prévisualisation.',
  })
  preview!: ImportRowPreviewDto[];
}

export class ImportQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description:
      'Simulation. Vaut VRAI par défaut : l’écriture doit être un acte explicite, pas ce qui arrive quand on oublie un paramètre.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      'Complète les fiches déjà en base au lieu de les rejeter. NE REMPLIT QUE LE VIDE : un statut déjà tranché, une note déjà écrite et une fiche qui porte déjà un appel ne sont jamais touchés.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  enrichir?: boolean;
}

export class RepresentantRelationChangeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) representantId!: string;

  @ApiProperty({ enum: RepresentantRelation, enumName: 'RepresentantRelation' })
  fromStatus!: RepresentantRelation;

  @ApiProperty({ enum: RepresentantRelation, enumName: 'RepresentantRelation' })
  toStatus!: RepresentantRelation;

  @ApiProperty({ type: String, nullable: true }) reason!: string | null;

  @ApiProperty({ format: 'uuid' }) changedById!: string;
  @ApiProperty() changedByName!: string;

  @ApiProperty({
    enum: ChangeSource,
    enumName: 'ChangeSource',
    description: 'Le canal qui a écrit la bascule.',
  })
  source!: ChangeSource;

  @ApiProperty({ type: String, format: 'date-time' }) changedAt!: string;
}

/** Un appel consigné, avec les réponses du script telles qu'elles ont été dites ce jour-là. */
export class RepresentantCallAttemptDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: RepCallOutcome, enumName: 'RepCallOutcome' }) outcome!: RepCallOutcome;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  statutQualificationId!: string | null;
  @ApiProperty({ type: String, nullable: true }) statutQualificationLabel!: string | null;
  @ApiProperty({
    type: Boolean,
    description:
      'Le statut exigeait un motif : `comment` porte alors ce motif, et non un commentaire libre.',
  })
  statutQualificationRequiresComment!: boolean;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) callbackAt!: string | null;
  @ApiProperty({ type: Number, nullable: true }) promisedProspects!: number | null;
  @ApiProperty({ type: Boolean, nullable: true }) etablissementConfirme!: boolean | null;
  @ApiProperty({ type: Boolean, nullable: true }) numeroConfirme!: boolean | null;
  @ApiProperty({ type: Boolean, nullable: true }) contacte!: boolean | null;
  @ApiProperty({ type: Boolean, nullable: true }) connaitUES!: boolean | null;
  @ApiProperty({ type: String, nullable: true }) syndicat!: string | null;
  @ApiProperty({ type: String, nullable: true }) suggestedName!: string | null;
  @ApiProperty({ type: String, nullable: true }) suggestedPhoneE164!: string | null;
  @ApiProperty({ type: String, nullable: true }) suggestedNote!: string | null;
  @ApiProperty({ type: String, nullable: true }) deviceCallType!: string | null;
  @ApiProperty({ type: Number, nullable: true }) deviceCallDurationSeconds!: number | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) deviceCallAt!: string | null;
  @ApiProperty({ format: 'uuid' }) performedById!: string;
  @ApiProperty() performedByName!: string;
  @ApiProperty({ type: String, format: 'date-time' }) clientCreatedAt!: string;
}

export class RepresentantCallAttemptListDto {
  @ApiProperty({
    type: () => [RepresentantCallAttemptDto],
    description: 'Du plus récent au plus ancien.',
  })
  items!: RepresentantCallAttemptDto[];
}

export class RepresentantRelationChangeListDto {
  @ApiProperty({
    type: () => [RepresentantRelationChangeDto],
    description: 'De la plus récente à la plus ancienne.',
  })
  items!: RepresentantRelationChangeDto[];
}

export class CreateRepresentantCommentDto {
  @ApiProperty({
    format: 'uuid',
    description: 'UUID v7 engendré par le client. Clé d’idempotence : un rejeu ne crée rien.',
  })
  @IsUUID()
  id!: string;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Horodatage de la saisie sur le terrain. Défaut : maintenant.',
  })
  @IsOptional()
  @IsISO8601()
  clientCreatedAt?: string;
}

export class RepresentantCommentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) representantId!: string;
  @ApiProperty({ format: 'uuid' }) authorId!: string;
  @ApiProperty() authorName!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: String, format: 'date-time' }) clientCreatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class RepresentantCommentListDto {
  @ApiProperty({
    type: () => [RepresentantCommentDto],
    description: 'Du plus récent au plus ancien.',
  })
  items!: RepresentantCommentDto[];

  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export class RepresentantCommentQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
