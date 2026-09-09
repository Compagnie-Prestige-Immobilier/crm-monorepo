import { ApiProperty } from '@nestjs/swagger';

/** Tranches d'ancienneté, en jours depuis l'ouverture du dossier. Montants en CHAÎNE : XOF est en `Decimal(18,0)`, au-delà de 2^53 un entier JSON perd la précision. */
export enum BankAgeBucket {
  J0_7 = 'J0_7',
  J8_15 = 'J8_15',
  J16_30 = 'J16_30',
  J31_60 = 'J31_60',
  J60_PLUS = 'J60_PLUS',
}

export class BankAgingBucketDto {
  @ApiProperty({ enum: BankAgeBucket, enumName: 'BankAgeBucket' })
  bucket!: BankAgeBucket;

  @ApiProperty({ description: 'Libellé prêt à afficher.' })
  label!: string;

  @ApiProperty({ type: Number })
  dossiers!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Part du total, en pourcentage. ' +
      'Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.',
  })
  share!: number | null;
}

export class BankAgingStageDto {
  @ApiProperty({ format: 'uuid' })
  stageId!: string;

  @ApiProperty({ description: 'Libellé de l’étape, issu du référentiel.' })
  label!: string;

  @ApiProperty({ type: Number })
  dossiers!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Part du total, en pourcentage. ' +
      'Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.',
  })
  share!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Durée médiane de stationnement à cette étape, en jours. Comptée depuis ' +
      'la dernière transition VERS l’étape, ou depuis l’ouverture du dossier ' +
      'quand il n’a jamais bougé. Nulle quand l’étape est vide.',
  })
  medianStationDays!: number | null;

  @ApiProperty({
    type: () => [BankAgingBucketDto],
    description: 'Ancienneté des dossiers de cette étape, les cinq tranches toujours présentes.',
  })
  buckets!: BankAgingBucketDto[];
}

export class BankAgingDto {
  @ApiProperty({
    type: () => [BankAgingBucketDto],
    description: 'Ancienneté, toutes étapes confondues.',
  })
  buckets!: BankAgingBucketDto[];

  @ApiProperty({
    type: () => [BankAgingStageDto],
    description: 'Une entrée par étape occupée, dans l’ordre du référentiel.',
  })
  stages!: BankAgingStageDto[];

  @ApiProperty({
    type: Number,
    description:
      'Dossiers observés : non supprimés et stationnant à une étape NON ' +
      'TERMINALE. Un dossier encaissé ou rejeté est sorti du portefeuille, et ' +
      'son ancienneté ne se pilote plus.',
  })
  total!: number;
}

export class WeeklyCohortDto {
  @ApiProperty({
    type: String,
    format: 'date',
    description: 'Lundi de la semaine d’entrée, au format AAAA-MM-JJ.',
  })
  week!: string;

  @ApiProperty({ type: Number, description: 'Prospects saisis cette semaine-là.' })
  prospects!: number;

  @ApiProperty({ type: Number })
  methodObtained!: number;

  @ApiProperty({
    type: Number,
    description: 'Prospects de la cohorte portant un dossier bancaire.',
  })
  cases!: number;

  @ApiProperty({
    type: Number,
    description: 'Prospects de la cohorte dont un dossier est encaissé.',
  })
  cashed!: number;

  @ApiProperty({
    type: String,
    description: 'Montant encaissé par la cohorte, en francs CFA. Chaîne.',
    example: '4500000',
  })
  cashedAmountXof!: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Part de la cohorte allée jusqu’à l’encaissement, en pourcentage. ' +
      'Rapportée aux prospects entrés, seule base qui rende deux semaines comparables. ' +
      'Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.',
  })
  conversionRate!: number | null;
}

export class WeeklyCohortListDto {
  @ApiProperty({ type: () => [WeeklyCohortDto], description: 'Semaines, de la plus ancienne.' })
  items!: WeeklyCohortDto[];

  @ApiProperty({ type: Number, description: 'Prospects toutes cohortes confondues.' })
  total!: number;
}

export class DepartementYieldDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ type: Number })
  prospects!: number;

  @ApiProperty({ type: Number })
  methodObtained!: number;

  @ApiProperty({ type: Number })
  cases!: number;

  @ApiProperty({ type: Number })
  cashed!: number;

  @ApiProperty({ type: String, description: 'Montant encaissé, en francs CFA. Chaîne.' })
  cashedAmountXof!: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Méthodes obtenues rapportées aux prospects, en %. ' +
      'Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.',
  })
  methodRate!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Encaissements rapportés aux prospects, en pourcentage. Le rendement réel. ' +
      'Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.',
  })
  conversionRate!: number | null;
}

export class DepartementYieldListDto {
  @ApiProperty({
    type: () => [DepartementYieldDto],
    description: 'Départements, du plus rentable.',
  })
  items!: DepartementYieldDto[];

  @ApiProperty({ type: Number, description: 'Prospects tous départements confondus.' })
  total!: number;
}
