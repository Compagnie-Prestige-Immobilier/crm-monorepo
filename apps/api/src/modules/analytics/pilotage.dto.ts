import { ApiProperty } from '@nestjs/swagger';

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
