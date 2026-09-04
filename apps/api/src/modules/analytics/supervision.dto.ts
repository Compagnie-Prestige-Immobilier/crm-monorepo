import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Projet } from '@crm/database';
import { IsEnum, IsISO8601, IsOptional, IsUUID, Matches } from 'class-validator';

import { PerformanceScore } from '../admin/performance-score.js';

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

  @ApiPropertyOptional({ example: '09:00', description: 'Heure de début quotidienne, Dakar.' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  timeFrom?: string;

  @ApiPropertyOptional({ example: '14:00', description: 'Heure de fin quotidienne, exclue.' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  timeTo?: string;
}

/**
 * Les mêmes colonnes pour une ligne d'agent et pour la ligne d'équipe. Les taux
 * de l'équipe se recalculent sur les sommes, jamais en moyennant les lignes.
 */
export class SupervisionActivityCountsDto {
  @ApiProperty({ type: Number, description: 'Appels passés à des prospects.' }) calls!: number;

  @ApiProperty({
    type: Number,
    description:
      'Parmi `calls`, ceux retrouvés dans le journal d’appels du téléphone Android. ' +
      'Un appel passé depuis un autre téléphone ou saisi après coup n’y est pas.',
  })
  confirmedCalls!: number;

  @ApiProperty({
    type: Number,
    description: 'Appels vers un prospect que le journal du téléphone a relevés, consignés ou non.',
  })
  detectedCalls!: number;

  @ApiProperty({
    type: Number,
    description:
      'Parmi `detectedCalls`, ceux qu’aucune tentative ne consigne. C’est le chiffre ' +
      'qui déclenche l’alerte de supervision.',
  })
  unloggedCalls!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Durée moyenne, en secondes, des `confirmedCalls`. `null` quand aucun appel ' +
      'prospect n’a été retrouvé au journal du téléphone.',
  })
  avgCallSeconds!: number | null;

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
      'Appels à des représentants, issues encore saisissables : REACHED, ' +
      'REFUSED, CALLBACK, UNREACHABLE, WRONG_NUMBER.',
  })
  repCalls!: number;

  @ApiProperty({
    type: Number,
    description: 'Parmi `repCalls`, ceux retrouvés dans le journal d’appels du téléphone Android.',
  })
  repConfirmedCalls!: number;

  @ApiProperty({
    type: Number,
    description:
      'Appels vers un représentant que le journal du téléphone a relevés, consignés ou non.',
  })
  repDetectedCalls!: number;

  @ApiProperty({
    type: Number,
    description: 'Parmi `repDetectedCalls`, ceux qu’aucune tentative ne consigne.',
  })
  repUnloggedCalls!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Durée moyenne, en secondes, des `repConfirmedCalls`. `null` quand aucun appel ' +
      'représentant n’a été retrouvé au journal du téléphone.',
  })
  repAvgCallSeconds!: number | null;

  @ApiProperty({
    type: Number,
    description: 'Issue WRONG_NUMBER : faux numéro parmi les appels représentants.',
  })
  repWrongNumber!: number;

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
      'OTHER. Hors de tous les taux.',
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
    description:
      'Part des appels représentants finissant en rappel, en pourcentage. ' +
      'Dénominateur : appels hors faux numéro.',
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

  @ApiProperty({
    type: Number,
    description:
      'Appels entrants relevés au journal du téléphone, les deux familles confondues. ' +
      'Une détection déjà consignée n’est comptée qu’une fois, par sa tentative.',
  })
  inboundCalls!: number;

  @ApiProperty({
    type: Number,
    description: 'Appels manqués relevés au journal du téléphone, les deux familles confondues.',
  })
  missedCalls!: number;

  @ApiProperty({
    type: Number,
    description:
      'Rappels prospects promis pour cette période et tenus : une tentative les a clos. ' +
      'Comptés sur la date PROMISE, pas sur celle de l’appel qui les a posés.',
  })
  callbacksHonored!: number;

  @ApiProperty({
    type: Number,
    description: 'Rappels prospects dont l’heure est passée et qu’aucune tentative n’a clos.',
  })
  callbacksLate!: number;

  @ApiProperty({ type: Number, description: 'Rappels prospects encore à venir.' })
  callbacksUpcoming!: number;

  @ApiProperty({
    type: Number,
    description:
      'Rappels représentants tenus : un appel a suivi l’heure promise, quel qu’en soit l’auteur.',
  })
  repCallbacksHonored!: number;

  @ApiProperty({
    type: Number,
    description: 'Rappels représentants dont l’heure est passée sans qu’aucun appel ait suivi.',
  })
  repCallbacksLate!: number;

  @ApiProperty({ type: Number, description: 'Rappels représentants encore à venir.' })
  repCallbacksUpcoming!: number;
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

export class SupervisionScoreDto {
  @ApiProperty({ format: 'uuid' }) teleconseillerId!: string;
  @ApiProperty() teleconseillerName!: string;

  @ApiProperty({
    type: Number,
    description: 'Présence relevée dans les créneaux, en secondes, sur toute la fenêtre.',
  })
  activeSecondsInShifts!: number;

  @ApiProperty({
    type: Number,
    description:
      'Secondes de créneau écoulées sur les seuls jours où le compte a été vu. La ' +
      'journée en cours ne compte que sa portion passée ; un filtre horaire restreint ' +
      'd’autant les créneaux.',
  })
  shiftSecondsElapsed!: number;

  @ApiProperty({ type: Number, description: 'Tentatives, prospects et représentants confondus.' })
  calls!: number;

  @ApiProperty({
    type: Number,
    description:
      'Prospects dont le numéro s’est révélé exploitable, plus représentants ayant répondu.',
  })
  reached!: number;

  @ApiProperty({
    type: Number,
    description:
      'Méthodes obtenues, plus représentants dont la DERNIÈRE réponse de la fenêtre est REACHED.',
  })
  qualified!: number;

  @ApiProperty({ type: Number, description: 'Appels au-delà du premier sur une même fiche.' })
  repeatCalls!: number;

  @ApiProperty({
    type: Number,
    description:
      'Écarts de plus de quinze minutes entre deux appels du même créneau et du même jour.',
  })
  deadSeconds!: number;

  @ApiProperty({ type: () => PerformanceScore })
  score!: PerformanceScore;
}

export class SupervisionRepStatutDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: Number }) count!: number;
}

export class SupervisionRepStatutsDto {
  @ApiProperty({
    type: Number,
    description: 'Représentants distincts comptés dans la répartition.',
  })
  total!: number;

  @ApiProperty({ type: () => [SupervisionRepStatutDto] })
  items!: SupervisionRepStatutDto[];
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
    type: () => [SupervisionScoreDto],
    description:
      'Une note par téléconseiller pour TOUTE la fenêtre, recalculée depuis les appels ' +
      'et la présence : rien n’est figé, corriger la définition corrige l’historique. ' +
      'Vide si le calcul a échoué.',
  })
  scores!: SupervisionScoreDto[];

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

  @ApiProperty({
    type: () => SupervisionRepStatutsDto,
    nullable: true,
    description:
      'Répartition des représentants par statut de qualification, basée sur ' +
      'leur dernier appel portant un statut dans la fenêtre. `null` sans ' +
      'représentant dans la fenêtre.',
  })
  repQualificationStatuses!: SupervisionRepStatutsDto | null;
}

export class WorkShiftDto {
  @ApiProperty({ enum: ['morning', 'afternoon'] }) key!: 'morning' | 'afternoon';
  @ApiProperty() label!: string;
  @ApiProperty({ example: '09:00' }) start!: string;
  @ApiProperty({ example: '14:00' }) end!: string;
}

export class WorkShiftsDto {
  @ApiProperty({ type: () => [WorkShiftDto] }) shifts!: WorkShiftDto[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) updatedAt!: string | null;
}

export class UpdateWorkShiftsDto {
  @ApiProperty({ example: '09:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) morningStart!: string;
  @ApiProperty({ example: '14:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) morningEnd!: string;
  @ApiProperty({ example: '15:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) afternoonStart!: string;
  @ApiProperty({ example: '18:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) afternoonEnd!: string;
}
