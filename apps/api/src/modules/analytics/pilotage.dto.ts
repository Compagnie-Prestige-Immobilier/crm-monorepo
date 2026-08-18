import { ApiProperty } from '@nestjs/swagger';

export class CampaignClosedDayDto {
  @ApiProperty({ type: String, format: 'date', description: 'Journée, au format AAAA-MM-JJ.' })
  day!: string;

  @ApiProperty({ format: 'uuid' })
  commercialId!: string;

  @ApiProperty()
  commercialName!: string;

  @ApiProperty({ type: Number, description: 'Tâches clôturées ce jour-là par ce commercial.' })
  done!: number;
}

export class CampaignPilotageDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Campagne observée. Nul quand aucune n’est précisée : le calcul porte ' +
      'alors sur l’ensemble des campagnes ACTIVES.',
  })
  campaignId!: string | null;

  @ApiProperty({ type: Number, description: 'Tâches de la campagne, toutes issues confondues.' })
  tasks!: number;

  @ApiProperty({ type: Number, description: 'Tâches ayant reçu au moins une tentative.' })
  tasksContacted!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Part des tâches touchées au moins une fois, en pourcentage. ' +
      'Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.',
  })
  contactRate!: number | null;

  @ApiProperty({ type: Number, description: 'Tentatives d’appel rattachées à la campagne.' })
  attempts!: number;

  @ApiProperty({
    type: Number,
    description: 'Tentatives dont l’issue n’est ni « injoignable » ni « faux numéro ».',
  })
  reachableAttempts!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Part des tentatives joignables, en pourcentage. ' +
      'Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.',
  })
  reachRate!: number | null;

  @ApiProperty({ type: Number, description: 'Tentatives ayant abouti à une méthode obtenue.' })
  methodsObtained!: number;

  @ApiProperty({
    type: Number,
    description:
      'Nombre moyen de tentatives pour une méthode obtenue. Vaut 0 tant qu’aucune ' +
      'méthode n’a été obtenue, faute de dénominateur.',
  })
  attemptsPerMethodObtained!: number;

  @ApiProperty({
    type: () => [CampaignClosedDayDto],
    description: 'Tâches clôturées, par jour et par commercial.',
  })
  closedPerDay!: CampaignClosedDayDto[];

  @ApiProperty({ type: Number, description: 'Tâches encore ouvertes.' })
  remaining!: number;

  @ApiProperty({
    type: Number,
    description: 'Cadence observée : tâches clôturées par jour sur les 7 derniers jours.',
  })
  observedPace!: number;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    description:
      'Date de fin projetée à la cadence observée. Nulle quand la cadence est ' +
      'nulle : une campagne à l’arrêt n’a pas de date de fin, et en annoncer ' +
      'une serait une division par zéro déguisée en prévision.',
  })
  estimatedEndDate!: string | null;
}

export enum DelayLeg {
  CREATION_TO_METHOD = 'CREATION_TO_METHOD',
  METHOD_TO_CASE = 'METHOD_TO_CASE',
  CASE_TO_CASHED = 'CASE_TO_CASHED',
}

export class DelayLegDto {
  @ApiProperty({ enum: DelayLeg, enumName: 'DelayLeg' })
  leg!: DelayLeg;

  @ApiProperty({ description: 'Libellé prêt à afficher.' })
  label!: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Durée médiane en jours. Nulle, et jamais 0, quand aucun couple ' +
      'd’horodatages n’est exploitable : 0 se lirait comme « instantané ».',
  })
  medianDays!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Neuvième décile en jours, pour la queue de distribution.',
  })
  p90Days!: number | null;

  @ApiProperty({ type: Number, description: 'Nombre de couples d’horodatages exploitables.' })
  sample!: number;
}

export class AnalyticsDelaysDto {
  @ApiProperty({
    type: () => [DelayLegDto],
    description: 'Les trois tronçons, du prospect saisi au dossier encaissé.',
  })
  legs!: DelayLegDto[];
}
