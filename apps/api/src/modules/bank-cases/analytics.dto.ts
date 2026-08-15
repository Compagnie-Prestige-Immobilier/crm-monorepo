import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { BankStageType } from '@crm/database';

import { BankCaseFilterDto } from './dto.js';
import { TimeGranularity } from '../analytics/dto.js';

/**
 * Agrégats Banque & Finance.
 *
 * TOUT est calculé en SQL. Aucun endpoint de ce fichier ne rapatrie de ligne :
 * un tableau de bord qui téléchargerait dix mille dossiers pour en compter les
 * encaissements transporterait des données nominatives sans raison et
 * s'effondrerait à la première vraie volumétrie.
 *
 * Le filtre est exactement celui de la liste, si bien qu'un compteur affiché
 * correspond toujours au contenu du tableau et du fichier exporté, c'est une
 * propriété testée, pas une intention.
 */

/**
 * Le pas de temps est `TimeGranularity` (module analytique), et non un
 * `BankTimeGranularity` de mêmes valeurs. Un jour, une semaine et un mois ne
 * changent pas de sens selon le tableau de bord qui les demande, et le doublon
 * faisait engendrer dans chaque client deux énumérations interchangeables que
 * le compilateur refusait pourtant de mélanger.
 */
export class BankAnalyticsQueryDto extends BankCaseFilterDto {
  @ApiPropertyOptional({
    enum: TimeGranularity,
    enumName: 'TimeGranularity',
    default: TimeGranularity.DAY,
  })
  @IsOptional()
  @IsEnum(TimeGranularity)
  granularity?: TimeGranularity;
}

export class BankAnalyticsTotalsDto {
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number, description: 'Dossiers sur l’étape initiale.' }) aTraiter!: number;
  @ApiProperty({ type: Number, description: 'Dossiers sur une étape ouverte non initiale.' })
  enTraitement!: number;
  @ApiProperty({ type: Number }) encaisses!: number;
  @ApiProperty({ type: Number }) rejetes!: number;
  @ApiProperty({ type: String, description: 'Somme encaissée, en chaîne. FCFA entiers.' })
  totalAmountCashed!: string;
  @ApiProperty({
    type: Number,
    description:
      'Rejetés / (encaissés + rejetés), en pourcentage arrondi au dixième. 0 sans issue.',
  })
  rejectionRate!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Délai moyen en heures entre la création et l’entrée en étape terminale. Nul tant qu’aucun dossier n’est clos.',
  })
  meanDelayHours!: number | null;
}

export class BankStageCountDto {
  @ApiProperty({ format: 'uuid' }) stageId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
  @ApiProperty() color!: string;
  @ApiProperty({ enum: BankStageType, enumName: 'BankStageType' }) type!: BankStageType;
  @ApiProperty({ type: Number }) cases!: number;
  @ApiProperty({ type: Number }) share!: number;
}

export class BankTimeBucketDto {
  @ApiProperty({ type: String, format: 'date-time' }) bucket!: string;
  @ApiProperty({ type: Number }) cases!: number;
  @ApiProperty({
    type: String,
    description: 'Montant du seau, en chaîne. « 0 » hors encaissement.',
  })
  amountXof!: string;
}

export class BankBankBreakdownDto {
  /** Même nom que partout ailleurs dans le contrat (voir `BankCaseFilterDto`). */
  @ApiProperty({ format: 'uuid' }) banqueId!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Number }) cases!: number;
  @ApiProperty({ type: Number }) cashed!: number;
  @ApiProperty({ type: Number }) rejected!: number;
  @ApiProperty({ type: String }) amountXof!: string;
  @ApiProperty({ type: Number }) share!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Durée moyenne de traitement en heures, création → étape terminale.',
  })
  meanProcessingHours!: number | null;
}

export class BankRejectionBreakdownDto {
  @ApiProperty({ format: 'uuid' }) reasonId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Number }) cases!: number;
  @ApiProperty({ type: Number }) share!: number;
}

export class BankAgentActivityDto {
  @ApiProperty({ format: 'uuid' }) agentId!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Number, description: 'Dossiers créés par l’agent.' }) created!: number;
  @ApiProperty({ type: Number, description: 'Transitions écrites par l’agent.' })
  transitions!: number;
  @ApiProperty({ type: Number, description: 'Dossiers menés à l’encaissement par l’agent.' })
  cashed!: number;
  @ApiProperty({ type: String, description: 'Montant encaissé par l’agent, en chaîne.' })
  amountXof!: string;
}

export class BankCaseAnalyticsDto {
  @ApiProperty({ type: () => BankAnalyticsTotalsDto }) totals!: BankAnalyticsTotalsDto;
  @ApiProperty({ type: () => [BankStageCountDto] }) byStage!: BankStageCountDto[];
  @ApiProperty({ type: () => [BankTimeBucketDto], description: 'Dossiers créés dans le temps.' })
  createdOverTime!: BankTimeBucketDto[];
  @ApiProperty({
    type: () => [BankTimeBucketDto],
    description: 'Encaissements dans le temps, en nombre et en montant.',
  })
  cashingsOverTime!: BankTimeBucketDto[];
  @ApiProperty({ type: () => [BankBankBreakdownDto] }) byBank!: BankBankBreakdownDto[];
  @ApiProperty({ type: () => [BankRejectionBreakdownDto] })
  byRejectionReason!: BankRejectionBreakdownDto[];
  @ApiProperty({ type: () => [BankAgentActivityDto] }) byAgent!: BankAgentActivityDto[];
}
