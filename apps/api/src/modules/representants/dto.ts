import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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

import { PageMetaDto, SortOrder } from '../../common/dto/prospect-filter.dto.js';
import { queryBoolean } from '../../common/dto/query-boolean.js';

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

export class UpdateRepresentantDto extends PartialType(CreateRepresentantDto) {}

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
}

export class RepresentantListDto {
  @ApiProperty({ type: () => [RepresentantDto] }) items!: RepresentantDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

/** Colonnes de tri admises. Fermée : un nom de colonne libre serait une injection. */
export enum RepresentantSortField {
  CLIENT_CREATED_AT = 'clientCreatedAt',
  CREATED_AT = 'createdAt',
  FULL_NAME = 'fullName',
  PROSPECTS = 'prospects',
}

/**
 * Filtres de la liste des représentants.
 *
 * Les cinq critères ajoutés (dates, tri, présence de prospects) portent
 * exactement les noms attendus par le panneau « Filtres avancés » du web, dont
 * l'état est porté par l'URL : un écart de nommage rendrait une URL partagée
 * impossible à reconstituer dans un autre onglet.
 */
/**
 * Filtres d'un listing de représentants, SANS pagination ni tri.
 *
 * Séparé de `RepresentantQueryDto` parce que l'export Excel n'a ni page ni
 * tri : `representants-export.service.ts` parcourt la table en keyset sur
 * `id asc` pour rendre la totalité du périmètre en flux, et ne lit donc ni
 * `page`, ni `pageSize`, ni `sortBy`, ni `sortOrder`.
 *
 * Tant que l'export réutilisait le DTO complet, le contrat ANNONÇAIT ces
 * quatre paramètres sur `/export/representants.xlsx`. Un client qui demandait
 * `?page=3&sortBy=prospects` recevait le classeur entier, trié par
 * identifiant, sans le moindre avertissement : le contrat promettait un
 * comportement que le serveur n'a jamais eu.
 */
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

  /**
   * Présence de prospects rattachés.
   *
   * `true` : au moins un prospect vivant. `false` : aucun, c'est-à-dire le
   * représentant DORMANT, la population que vise la campagne de relance. Le
   * filtre ne compte que les prospects non supprimés : un représentant dont
   * toutes les fiches ont été effacées est redevenu dormant, et le voir compté
   * comme actif ferait manquer exactement les cas à rappeler.
   */
  @ApiPropertyOptional({
    type: Boolean,
    description: 'true : au moins un prospect vivant. false : aucun (représentant dormant).',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  hasProspects?: boolean;
}

/**
 * Les mêmes filtres, plus la pagination et le tri du listing paginé.
 *
 * L'héritage garantit qu'un filtre ajouté un jour au listing arrive
 * automatiquement dans l'export, et qu'il n'existe jamais deux définitions
 * d'un même critère susceptibles de diverger.
 */
export class RepresentantQueryDto extends RepresentantExportQueryDto {
  @ApiPropertyOptional({ enum: RepresentantSortField, enumName: 'RepresentantSortField' })
  @IsOptional()
  @IsEnum(RepresentantSortField)
  sortBy?: RepresentantSortField;

  /**
   * `SortOrder` (commun) et non une énumération propre au module : « asc / desc »
   * ne dépend pas de ce qu'on trie. Le doublon `RepresentantSortOrder`, de
   * valeurs identiques, faisait porter à chaque client engendré deux types pour
   * le même choix, et rendait possible une divergence sans aucun sens.
   */
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

/**
 * Réponse du lookup par téléphone.
 *
 * `found: false` plutôt qu'un 404 : « ce numéro est libre » est une réponse
 * métier normale sur le chemin de saisie, pas une erreur. Un 404 obligerait
 * l'app mobile à traiter comme exception le cas le plus fréquent.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Import de masse
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Une ligne du classeur qui n'a PAS pu être retenue.
 *
 * Le numéro de ligne est celui du FICHIER, en-tête compris : c'est ce que la
 * personne voit dans Excel. Renvoyer un index de tableau la ferait chercher au
 * mauvais endroit, sur un fichier de mille lignes.
 */
export class ImportRowErrorDto {
  @ApiProperty({ type: Number, description: 'Numéro de ligne dans le fichier, en-tête compris.' })
  line!: number;

  @ApiProperty({ description: 'Code stable du motif, pour que l’interface puisse le traduire.' })
  code!: string;

  @ApiProperty({ description: 'Motif lisible, prêt à afficher.' }) message!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Valeur fautive, telle que saisie.' })
  value!: string | null;
}

/** Une ligne retenue, telle qu'elle sera écrite. Sert au tableau de prévisualisation. */
export class ImportRowPreviewDto {
  @ApiProperty({ type: Number }) line!: number;
  @ApiProperty() fullName!: string;
  @ApiProperty({ description: 'Téléphone normalisé E.164 par le serveur.' }) phoneE164!: string;
  @ApiProperty() departementName!: string;
  @ApiProperty({ type: String, nullable: true }) iefName!: string | null;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
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
}
