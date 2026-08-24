import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
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
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

import { PageMetaDto, SortOrder } from '../../common/dto/prospect-filter.dto.js';
import { queryBoolean } from '../../common/dto/query-boolean.js';

export enum VisiteSortField {
  VISITED_AT = 'visitedAt',
  VISITOR_NAME = 'visitorName',
  ENTREPRISE = 'entreprise',
  DIRECTION = 'direction',
  DESTINATAIRE = 'destinataire',
  OBJET = 'objet',
}

export const VISITE_REFERENTIEL_KINDS = [
  'entreprises',
  'directions',
  'destinataires',
  'objets',
] as const;

export type VisiteReferentielKind = (typeof VISITE_REFERENTIEL_KINDS)[number];

/** Forme attendue par `ParseEnumPipe`, qui refuse un `kind` inventé dans l'URL. */
export const VisiteReferentielKindEnum: Readonly<
  Record<VisiteReferentielKind, VisiteReferentielKind>
> = {
  entreprises: 'entreprises',
  directions: 'directions',
  destinataires: 'destinataires',
  objets: 'objets',
};

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const CODE_PATTERN = /^[A-Z0-9_]+$/;

export class VisiteReferentielDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'Code stable, jamais modifiable après création.' }) code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({
    type: Boolean,
    description: 'Entrée reprise du classeur d’origine : renommable, désactivable, jamais effacée.',
  })
  isSystem!: boolean;
  @ApiProperty({ type: Number }) sortOrder!: number;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class VisiteReferentielListDto {
  @ApiProperty({ type: () => [VisiteReferentielDto] }) items!: VisiteReferentielDto[];
}

export class VisiteReferentielsBundleDto {
  @ApiProperty({ type: () => [VisiteReferentielDto] }) entreprises!: VisiteReferentielDto[];
  @ApiProperty({ type: () => [VisiteReferentielDto] }) directions!: VisiteReferentielDto[];
  @ApiProperty({ type: () => [VisiteReferentielDto] }) destinataires!: VisiteReferentielDto[];
  @ApiProperty({ type: () => [VisiteReferentielDto] }) objets!: VisiteReferentielDto[];
}

export class VisiteReferentielQueryDto {
  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  activeOnly?: boolean;
}

export class CreateVisiteReferentielDto {
  @ApiProperty({
    maxLength: 48,
    description: 'Majuscules, chiffres et tirets bas. Immuable une fois créé.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(CODE_PATTERN)
  code!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @ApiPropertyOptional({ type: Number, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}

export class UpdateVisiteReferentielDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}

export class SetVisiteReferentielActiveDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  isActive!: boolean;
}

export class ReorderVisiteReferentielDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Les entrées dans leur nouvel ordre. Celles omises gardent leur rang.',
  })
  @IsUUID('4', { each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(200)
  @ArrayUnique()
  ids!: string[];
}

export class VisiteReferentielRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
}

export class VisiteDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty({
    example: 'V-2026-000412',
    description: 'Le « N° » du registre. Engendré par le serveur, immuable.',
  })
  reference!: string;

  @ApiProperty({ example: '2026-01-06', description: 'Jour de la visite, à Dakar.' })
  date!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '11:08',
    description: 'Nul quand l’heure n’a pas été relevée.',
  })
  time!: string | null;

  @ApiProperty() visitorName!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Le numéro tel qu’il a été donné.' })
  phone!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Forme E.164, nulle quand le numéro donné n’a pas pu être reconnu.',
  })
  phoneE164!: string | null;

  @ApiProperty({ type: () => VisiteReferentielRefDto }) entreprise!: VisiteReferentielRefDto;
  @ApiProperty({ type: () => VisiteReferentielRefDto }) objet!: VisiteReferentielRefDto;

  @ApiProperty({ type: () => VisiteReferentielRefDto, nullable: true })
  direction!: VisiteReferentielRefDto | null;

  @ApiProperty({ type: () => VisiteReferentielRefDto, nullable: true })
  destinataire!: VisiteReferentielRefDto | null;

  @ApiProperty({ type: String, nullable: true }) comment!: string | null;

  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class VisiteListDto {
  @ApiProperty({ type: () => [VisiteDto] }) items!: VisiteDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export class CreateVisiteDto {
  @ApiProperty({ example: '2026-01-06' })
  @IsString()
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true, strictSeparator: true })
  date!: string;

  @ApiPropertyOptional({ example: '11:08', description: 'Omise si elle n’a pas été relevée.' })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN)
  time?: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  visitorName!: string;

  @ApiPropertyOptional({
    maxLength: 40,
    description: 'Accepté sous n’importe quelle forme, y compris étrangère ou incomplète.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  entrepriseId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  objetId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  directionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  destinataireId?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class UpdateVisiteDto {
  @ApiPropertyOptional({ type: String, example: '11:08', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN)
  time?: string | null;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  visitorName?: string;

  @ApiPropertyOptional({ type: String, maxLength: 40, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  entrepriseId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  objetId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  directionId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  destinataireId?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}

/**
 * Les sept filtres du registre, communs à la liste et à l'export : ce qui est
 * exporté doit être exactement ce qui est affiché. `VisiteQueryDto` y ajoute
 * la pagination et le tri, que l'export ne lit pas.
 */
export class VisiteFilterDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true, strictSeparator: true })
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true, strictSeparator: true })
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  entrepriseId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  directionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  destinataireId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  objetId?: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Nom du visiteur, ou référence du registre.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  search?: string;
}

export class VisiteQueryDto extends VisiteFilterDto {
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

  @ApiPropertyOptional({ enum: VisiteSortField, enumName: 'VisiteSortField' })
  @IsOptional()
  @IsEnum(VisiteSortField)
  sortBy?: VisiteSortField;

  @ApiPropertyOptional({ enum: SortOrder, enumName: 'SortOrder' })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}

export class VisiteStatsQueryDto {
  @ApiProperty({ example: '2025-01-01', description: 'Premier jour compté, inclus.' })
  @IsString()
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true, strictSeparator: true })
  from!: string;

  @ApiProperty({ example: '2025-12-31', description: 'Dernier jour compté, inclus.' })
  @IsString()
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true, strictSeparator: true })
  to!: string;
}

export class VisiteStatBucketDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Number }) count!: number;
}

export class VisiteStatMoisDto {
  @ApiProperty({ example: '2025-01' }) month!: string;
  @ApiProperty({ type: Number }) count!: number;
}

export class VisiteStatJourDto {
  @ApiProperty({ example: '2025-01-06' }) date!: string;
  @ApiProperty({ type: Number }) count!: number;
}

export class VisiteStatHeureDto {
  @ApiProperty({ minimum: 0, maximum: 23 }) hour!: number;
  @ApiProperty({ type: Number }) count!: number;
}

export class VisiteStatJourSemaineDto {
  @ApiProperty({ minimum: 1, maximum: 7, description: 'ISO : lundi = 1.' }) weekday!: number;
  @ApiProperty({ type: Number }) count!: number;
}

export class VisiteStatHeureJourSemaineDto {
  @ApiProperty({ minimum: 1, maximum: 7 }) weekday!: number;
  @ApiProperty({ minimum: 0, maximum: 23 }) hour!: number;
  @ApiProperty({ type: Number }) count!: number;
}

export class VisiteStatAgentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'L’agent d’accueil qui a saisi la visite.' }) label!: string;
  @ApiProperty({ type: Number }) count!: number;
}

export class VisiteStatCroisementDto {
  @ApiProperty({ description: 'Identifiant de la dimension en ligne.' }) ligneId!: string;
  @ApiProperty({ description: 'Identifiant de la dimension en colonne.' }) colonneId!: string;
  @ApiProperty({ type: Number }) count!: number;
}

export class VisiteStatRecurrentDto {
  @ApiProperty() nom!: string;
  @ApiProperty({ type: Number }) visites!: number;
  @ApiProperty({ example: '2026-01-06' }) derniereVisite!: string;
}

export class VisiteStatSaisieDto {
  @ApiProperty({ type: Number, description: 'Saisies faites le jour même de la visite.' })
  memeJour!: number;
  @ApiProperty({ type: Number, description: 'Saisies faites le lendemain de la visite.' })
  lendemain!: number;
  @ApiProperty({ type: Number, description: 'Saisies faites deux jours après la visite ou plus.' })
  plusTard!: number;
  @ApiProperty({ type: Number, nullable: true }) delaiMedianHeures!: number | null;
}

export class VisiteStatsDto {
  @ApiProperty({ example: '2025-01-01' }) from!: string;
  @ApiProperty({ example: '2025-12-31' }) to!: string;

  @ApiProperty({
    type: Number,
    description:
      'Nombre de visites. La somme d’une répartition peut lui être inférieure : direction et destinataire sont facultatifs.',
  })
  total!: number;

  @ApiProperty({
    type: () => [VisiteStatBucketDto],
    description: 'Toutes les entrées actives du référentiel, y compris celles à zéro.',
  })
  parEntreprise!: VisiteStatBucketDto[];

  @ApiProperty({ type: () => [VisiteStatBucketDto] }) parDirection!: VisiteStatBucketDto[];
  @ApiProperty({ type: () => [VisiteStatBucketDto] }) parDestinataire!: VisiteStatBucketDto[];
  @ApiProperty({ type: () => [VisiteStatBucketDto] }) parObjet!: VisiteStatBucketDto[];

  @ApiProperty({ type: () => [VisiteStatMoisDto], description: 'Chaque mois de la période.' })
  parMois!: VisiteStatMoisDto[];

  @ApiProperty({
    type: () => [VisiteStatJourDto],
    description: 'Seuls les jours ayant reçu au moins une visite.',
  })
  parJour!: VisiteStatJourDto[];

  @ApiProperty({ type: Number }) sansDirection!: number;
  @ApiProperty({ type: Number }) sansDestinataire!: number;

  @ApiProperty({
    type: () => [VisiteStatHeureDto],
    description:
      'Les 24 heures de la journée, à Dakar. Les visites sans heure relevée en sont exclues.',
  })
  parHeure!: VisiteStatHeureDto[];

  @ApiProperty({ type: Number, description: 'Visites sans heure relevée.' }) sansHeure!: number;

  @ApiProperty({
    type: () => [VisiteStatJourSemaineDto],
    description: 'Les 7 jours de la semaine ISO (lundi = 1), toutes visites comprises.',
  })
  parJourSemaine!: VisiteStatJourSemaineDto[];

  @ApiProperty({
    type: () => [VisiteStatHeureJourSemaineDto],
    description: 'Croisement heure × jour de semaine, cellules non nulles seulement, 168 au plus.',
  })
  parHeureJourSemaine!: VisiteStatHeureJourSemaineDto[];

  @ApiProperty({
    type: () => [VisiteStatAgentDto],
    description: 'L’agent d’accueil qui a saisi chaque visite.',
  })
  parAgent!: VisiteStatAgentDto[];

  @ApiProperty({ type: () => [VisiteStatCroisementDto] })
  parEntrepriseObjet!: VisiteStatCroisementDto[];
  @ApiProperty({ type: () => [VisiteStatCroisementDto] })
  parDestinataireDirection!: VisiteStatCroisementDto[];
  @ApiProperty({ type: () => [VisiteStatCroisementDto] }) parObjetMois!: VisiteStatCroisementDto[];

  @ApiProperty({
    type: () => [VisiteStatRecurrentDto],
    description:
      'Visiteurs vus au moins deux fois sur la période, dix au plus. Regroupés par téléphone, sinon par nom : jamais le numéro.',
  })
  recurrents!: VisiteStatRecurrentDto[];

  @ApiProperty({
    type: Number,
    description: 'Part des visites faites par des visiteurs récurrents.',
  })
  partRecurrents!: number;

  @ApiProperty({ type: Number, description: 'Visites portant un numéro de téléphone.' })
  avecTelephone!: number;

  @ApiProperty({
    type: () => VisiteStatSaisieDto,
    description: 'Délai entre la visite et sa saisie.',
  })
  saisieDifferee!: VisiteStatSaisieDto;
}

export const DASHBOARD_SOURCES = [
  'total-visites',
  'moyenne-journaliere',
  'jour-le-plus-charge',
  'par-entreprise',
  'par-objet',
  'par-direction',
  'par-destinataire',
  'par-jour',
  'par-mois',
  'par-heure',
  'par-jour-semaine',
  'par-heure-jour-semaine',
  'par-agent',
  'par-entreprise-objet',
  'par-destinataire-direction',
  'par-objet-mois',
  'visiteurs-recurrents',
  'avec-telephone',
  'qualite-de-saisie',
] as const;

export type DashboardSource = (typeof DASHBOARD_SOURCES)[number];

export const DASHBOARD_MARQUES = [
  'barres-verticales',
  'barres-horizontales',
  'barres-empilees',
  'barres-100',
  'barres-groupees',
  'courbe',
  'aire',
  'escalier',
  'anneau',
  'camembert',
  'aire-polaire',
  'radar',
  'nuage',
  'bulles',
  'mixte',
  'jauge',
  'carte-de-chaleur',
  'tableau',
  'tuile',
  'tuile-courbe',
] as const;

export type DashboardMarque = (typeof DASHBOARD_MARQUES)[number];

export const DASHBOARD_TAILLES = ['demi', 'pleine'] as const;
export type DashboardTaille = (typeof DASHBOARD_TAILLES)[number];

export const DASHBOARD_PRESETS = ['essentiel', 'affluence', 'organisation', 'complet'] as const;
export type DashboardPreset = (typeof DASHBOARD_PRESETS)[number];

@ValidatorConstraint({ name: 'uniqueDispositionSources', async: false })
export class UniqueDispositionSourcesConstraint implements ValidatorConstraintInterface {
  validate(widgets: unknown): boolean {
    if (!Array.isArray(widgets)) return true;
    const sources = new Set<string>();
    for (const widget of widgets as { source?: unknown }[]) {
      if (typeof widget.source === 'string') sources.add(widget.source);
    }
    return sources.size === widgets.length;
  }

  defaultMessage(): string {
    return 'Chaque source ne peut apparaître qu’une seule fois dans la disposition.';
  }
}

export class DispositionPresentationDto {
  @ApiPropertyOptional({ enum: ['neutre', 'serie', 'categorielle'] })
  @IsOptional()
  @IsIn(['neutre', 'serie', 'categorielle'])
  palette?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  valeurs?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  legende?: boolean;

  @ApiPropertyOptional({ enum: ['valeur-desc', 'valeur-asc', 'alphabetique'] })
  @IsOptional()
  @IsIn(['valeur-desc', 'valeur-asc', 'alphabetique'])
  tri?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  autresApres?: number;
}

export class DispositionWidgetDto {
  @ApiProperty({ enum: DASHBOARD_SOURCES, enumName: 'DashboardSource' })
  @IsIn(DASHBOARD_SOURCES)
  source!: DashboardSource;

  @ApiPropertyOptional({ enum: DASHBOARD_MARQUES, enumName: 'DashboardMarque' })
  @IsOptional()
  @IsIn(DASHBOARD_MARQUES)
  marque?: DashboardMarque;

  @ApiPropertyOptional({ enum: DASHBOARD_TAILLES, enumName: 'DashboardTaille' })
  @IsOptional()
  @IsIn(DASHBOARD_TAILLES)
  taille?: DashboardTaille;

  @ApiPropertyOptional({ type: () => DispositionPresentationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DispositionPresentationDto)
  presentation?: DispositionPresentationDto;
}

export class UpdateDispositionDto {
  @ApiPropertyOptional({ enum: DASHBOARD_PRESETS, enumName: 'DashboardPreset' })
  @IsOptional()
  @IsIn(DASHBOARD_PRESETS)
  preset?: DashboardPreset;

  @ApiProperty({
    type: () => [DispositionWidgetDto],
    description:
      'Les éléments du tableau de bord. `version` est fixé par le serveur et refusé s’il est transmis.',
  })
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => DispositionWidgetDto)
  @Validate(UniqueDispositionSourcesConstraint)
  widgets!: DispositionWidgetDto[];
}

export class DispositionResponseDto {
  @ApiProperty({ type: () => [DispositionWidgetDto] }) widgets!: DispositionWidgetDto[];
  @ApiProperty({ enum: DASHBOARD_PRESETS, enumName: 'DashboardPreset' }) preset!: DashboardPreset;

  @ApiProperty({
    enum: ['utilisateur', 'defaut', 'usine'],
    description:
      'D’où vient la disposition rendue : la sienne, celle fixée par l’administrateur, ou celle d’usine.',
  })
  source!: 'utilisateur' | 'defaut' | 'usine';

  @ApiProperty({ type: String, format: 'date-time', nullable: true }) updatedAt!: string | null;
}
