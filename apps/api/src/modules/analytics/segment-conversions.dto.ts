import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { BddSegment, ChangeSource } from '@crm/database';

import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';

/**
 * Les conversions de segment, vues d'en haut.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LES TROIS QUESTIONS, ET LES TROIS INDEX QUI LES SERVENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `SegmentChange` porte trois index composites, et ce ne sont pas des index de
 * confort : chacun répond à une question que la direction pose réellement.
 *
 *   `(toSegment, changedAt)`  → combien de bascules vers BDD1 sur la période ;
 *   `(changedById, changedAt)`→ qui a converti, et combien ;
 *   `(prospectId, changedAt)` → l'histoire d'une fiche, servie ailleurs par
 *                               `GET /prospects/:id/segment-history`.
 *
 * Les deux premières se répondent ICI, dans une seule opération : les séparer
 * en trois endpoints obligerait l'écran à trois appels dont rien ne
 * garantirait qu'ils décrivent la même période.
 */
export class SegmentConversionsQueryDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne basse sur la date de bascule, incluse. Une date nue vaut minuit à Dakar.',
  })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne haute sur la date de bascule, incluse. Une date nue vaut 23:59:59 à Dakar.',
  })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({
    enum: BddSegment,
    enumName: 'BddSegment',
    description: 'Segment de DÉPART. « Combien de BDD3 avons-nous fait basculer. »',
  })
  @IsOptional()
  @IsEnum(BddSegment)
  fromSegment?: BddSegment;

  @ApiPropertyOptional({
    enum: BddSegment,
    enumName: 'BddSegment',
    description: 'Segment d’ARRIVÉE. « Combien de conversions vers BDD1. »',
  })
  @IsOptional()
  @IsEnum(BddSegment)
  toSegment?: BddSegment;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Auteur de la bascule. Réservé à l’ADMIN : un COMMERCIAL ne voit que les siennes.',
  })
  @IsOptional()
  @IsUUID()
  changedById?: string;

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

/** Une bascule, avec de quoi la lire sans second appel. */
export class SegmentConversionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) prospectId!: string;
  @ApiProperty({ description: 'Prénom et nom de la fiche convertie, au moment de la lecture.' })
  prospectName!: string;

  @ApiProperty({ enum: BddSegment, enumName: 'BddSegment' }) fromSegment!: BddSegment;
  @ApiProperty({ enum: BddSegment, enumName: 'BddSegment' }) toSegment!: BddSegment;

  @ApiProperty({ type: String, nullable: true }) reason!: string | null;

  @ApiProperty({ format: 'uuid' }) changedById!: string;
  @ApiProperty() changedByName!: string;

  @ApiProperty({ enum: ChangeSource, enumName: 'ChangeSource' }) source!: ChangeSource;
  @ApiProperty({ type: String, format: 'date-time' }) changedAt!: string;
}

/** Décompte par segment de départ : la question « d'où viennent-elles ». */
export class SegmentConversionOriginDto {
  @ApiProperty({ enum: BddSegment, enumName: 'BddSegment' }) segment!: BddSegment;
  @ApiProperty({ type: Number }) conversions!: number;
}

/** Décompte par auteur : la question « par qui ». */
export class SegmentConversionAuthorDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: Number }) conversions!: number;
}

export class SegmentConversionListDto {
  @ApiProperty({
    type: () => [SegmentConversionDto],
    description: 'De la plus récente à la plus ancienne.',
  })
  items!: SegmentConversionDto[];

  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;

  /*
   * Les deux décomptes portent sur TOUTE la période filtrée, jamais sur la
   * page affichée. Les calculer sur la page ferait varier « 12 conversions
   * depuis BDD3 » d'un clic de pagination à l'autre, sur des données
   * strictement identiques.
   */
  @ApiProperty({ type: () => [SegmentConversionOriginDto] })
  byOriginSegment!: SegmentConversionOriginDto[];

  @ApiProperty({ type: () => [SegmentConversionAuthorDto] })
  byAuthor!: SegmentConversionAuthorDto[];
}
