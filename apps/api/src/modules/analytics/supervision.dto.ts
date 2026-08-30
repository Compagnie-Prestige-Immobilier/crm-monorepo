import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Projet } from '@crm/database';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';

export enum SupervisionGranularity {
  DAY = 'day',
  WEEK = 'week',
}

export class SupervisionQueryDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Borne basse sur la date de l’ACTE, incluse : heure d’appel, de saisie ou de ' +
      'clôture relevée chez le client, et non date d’arrivée en base. Une date seule ' +
      '(AAAA-MM-JJ) démarre à minuit, fuseau Africa/Dakar.',
  })
  @IsOptional()
  @IsISO8601()
  actFrom?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne haute sur la date de l’acte, incluse. Une date seule finit à 23:59:59.999.',
  })
  @IsOptional()
  @IsISO8601()
  actTo?: string;

  @ApiPropertyOptional({
    enum: SupervisionGranularity,
    enumName: 'SupervisionGranularity',
    default: SupervisionGranularity.DAY,
  })
  @IsOptional()
  @IsEnum(SupervisionGranularity)
  granularity?: SupervisionGranularity;

  @ApiPropertyOptional({
    enum: Projet,
    enumName: 'Projet',
    description:
      'Le projet. ABSENT veut dire les deux. Un représentant n’existe que dans ' +
      'CHUES : sous `GRAND_PUBLIC`, toutes les colonnes `rep*` valent 0 ou `null`.',
  })
  @IsOptional()
  @IsEnum(Projet)
  projet?: Projet;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Un seul téléconseiller : borne les lignes, la liste et les histogrammes.',
  })
  @IsOptional()
  @IsUUID()
  commercialId?: string;
}

/**
 * Les mêmes colonnes pour une ligne d'agent et pour la ligne d'équipe. Les taux
 * de l'équipe se recalculent sur les sommes, jamais en moyennant les lignes.
 */
export class SupervisionActivityCountsDto {
  @ApiProperty({ type: Number, description: 'Appels passés à des prospects.' }) calls!: number;
  @ApiProperty({ type: Number, description: 'Issue UNREACHABLE : NRP ou injoignable.' })
  unreachable!: number;

  @ApiProperty({ type: Number, description: 'Issue WRONG_NUMBER : faux numéro.' })
  wrongNumber!: number;

  @ApiProperty({ type: Number, description: 'Issue REFUSED : refus.' }) refused!: number;
  @ApiProperty({ type: Number, description: 'Issue OTHER.' }) other!: number;
  @ApiProperty({ type: Number, description: 'Issue METHOD_OBTAINED.' }) methodObtained!: number;
  @ApiProperty({ type: Number, description: 'Issue CALLBACK : à rappeler.' }) callback!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Part des appels dont le numéro s’est révélé exploitable, en pourcentage. ' +
      '`null` sans aucun appel : « personne appelé » n’est pas « personne joint ».',
  })
  reachRate!: number | null;

  @ApiProperty({ type: Number, description: 'Fiches prospect saisies sur la période.' })
  prospectsCreated!: number;

  @ApiProperty({ type: Number, description: 'Représentants distincts appelés sur la période.' })
  representantsContacted!: number;

  @ApiProperty({
    type: Number,
    description:
      'Appels à des représentants, issues encore saisissables seulement : REACHED, ' +
      'REFUSED, CALLBACK, UNREACHABLE. Dénominateur de `repContactRate` et de ' +
      '`repCallbackRate`.',
  })
  repCalls!: number;

  @ApiProperty({
    type: Number,
    description:
      'Représentants qui ont DÉCROCHÉ et répondu : REACHED ou REFUSED. Un refus est ' +
      'un contact ; un rappel promis n’en est pas encore un.',
  })
  repReached!: number;

  @ApiProperty({ type: Number, description: 'Issue CALLBACK : rappel promis, date posée.' })
  repCallback!: number;

  @ApiProperty({ type: Number, description: 'Issue UNREACHABLE : n’a pas décroché.' })
  repUnreachable!: number;

  @ApiProperty({
    type: Number,
    description:
      'Issues d’héritage que le terrain ne saisit plus : PROSPECTS_PROMISED, ' +
      'WRONG_NUMBER, OTHER. Hors de tous les taux.',
  })
  repOther!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Part des appels représentants où quelqu’un a répondu, en pourcentage. ' +
      '`null` sans aucun appel.',
  })
  repContactRate!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Part des appels représentants finissant en rappel, en pourcentage.',
  })
  repCallbackRate!: number | null;

  @ApiProperty({
    type: Number,
    description:
      'Représentants DISTINCTS dont la dernière réponse de la fenêtre a été obtenue ' +
      'par ce téléconseiller. Attribué à qui a obtenu la réponse, pas à qui a appelé ' +
      'le premier. NON SOMMABLE entre périodes ni entre téléconseillers.',
  })
  repQuestioned!: number;

  @ApiProperty({
    type: Number,
    description:
      'Parmi `repQuestioned`, ceux dont cette dernière réponse est REACHED. NON SOMMABLE.',
  })
  repQualified!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Part des représentants interrogés qui ont dit oui, en pourcentage. `null` sans ' +
      'aucun représentant interrogé.',
  })
  repQualificationRate!: number | null;
}

export class SupervisionActivityRowDto extends SupervisionActivityCountsDto {
  @ApiProperty({ description: 'Début de la journée ou de la semaine, en AAAA-MM-JJ.' })
  bucket!: string;

  @ApiProperty({ format: 'uuid' }) teleconseillerId!: string;
  @ApiProperty() teleconseillerName!: string;
}

export class SupervisionTeleconseillerDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
}

export class SupervisionHistogramBarDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) id!: string | null;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Number }) prospects!: number;
}

export class SupervisionActivityDto {
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) from!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) to!: string | null;

  @ApiProperty({ enum: SupervisionGranularity, enumName: 'SupervisionGranularity' })
  granularity!: SupervisionGranularity;

  @ApiProperty({
    type: () => [SupervisionActivityRowDto],
    description:
      'Une ligne par téléconseiller et par période, seulement là où il s’est passé quelque chose.',
  })
  items!: SupervisionActivityRowDto[];

  @ApiProperty({
    type: () => SupervisionActivityCountsDto,
    description:
      'L’équipe entière sur TOUTE la fenêtre, filtres compris. Calculé côté serveur : ' +
      '`representantsContacted`, `repQuestioned` et `repQualified` comptent des ' +
      'personnes distinctes, et la somme des lignes en compterait certaines deux fois.',
  })
  totals!: SupervisionActivityCountsDto;

  @ApiProperty({
    type: () => [SupervisionTeleconseillerDto],
    description: 'Tous les téléconseillers, y compris ceux sans aucun acte sur la fenêtre.',
  })
  teleconseillers!: SupervisionTeleconseillerDto[];

  @ApiProperty({
    type: () => [SupervisionHistogramBarDto],
    description: 'Stock courant de prospects rattachés à chaque téléconseiller.',
  })
  prospectsByTeleconseiller!: SupervisionHistogramBarDto[];

  @ApiProperty({
    type: () => [SupervisionHistogramBarDto],
    description: 'Stock courant de prospects rattachés à chaque représentant.',
  })
  prospectsByRepresentant!: SupervisionHistogramBarDto[];
}
