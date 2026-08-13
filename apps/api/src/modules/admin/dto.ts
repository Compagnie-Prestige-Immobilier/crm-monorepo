import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsString, MaxLength } from 'class-validator';

import { PURGE_DOMAIN_KEYS, type PurgeDomainKey } from './purge-plan.js';

/** Catalogue d'un domaine purgeable, tel que l'écran l'affiche. */
export class PurgeDomainDto {
  @ApiProperty({ enum: PURGE_DOMAIN_KEYS, enumName: 'PurgeDomainKey' })
  key!: PurgeDomainKey;

  @ApiProperty() label!: string;
  @ApiProperty() hint!: string;

  @ApiProperty({
    type: [String],
    description:
      'Domaines entraînés par celui-ci, clés étrangères obligent. L’écran les coche avec lui.',
  })
  requires!: PurgeDomainKey[];

  @ApiProperty({ type: Number, description: 'Lignes actuellement concernées.' })
  rows!: number;
}

export class PurgeCatalogDto {
  @ApiProperty({
    type: Boolean,
    description:
      'Vrai si le compte appelant est le premier administrateur, seul habilité à purger.',
  })
  allowed!: boolean;

  @ApiProperty({
    type: String,
    description: 'Identifiant de connexion à ressaisir pour confirmer.',
  })
  confirmationHint!: string;

  @ApiProperty({ type: () => [PurgeDomainDto] })
  domains!: PurgeDomainDto[];
}

export class PurgeRequestDto {
  @ApiProperty({
    enum: PURGE_DOMAIN_KEYS,
    enumName: 'PurgeDomainKey',
    isArray: true,
    description: 'Domaines cochés. Le serveur y ajoute leurs dépendances.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(PURGE_DOMAIN_KEYS.length)
  @IsIn(PURGE_DOMAIN_KEYS, { each: true })
  domains!: PurgeDomainKey[];

  @ApiProperty({
    maxLength: 254,
    description:
      'Identifiant de connexion de l’administrateur, ressaisi. Comparé à son e-mail ou à son nom d’utilisateur.',
  })
  @IsString()
  @MaxLength(254)
  confirmation!: string;
}

export class PurgeDeletionDto {
  @ApiProperty({ enum: PURGE_DOMAIN_KEYS, enumName: 'PurgeDomainKey' })
  key!: PurgeDomainKey;

  @ApiProperty() label!: string;
  @ApiProperty({ type: Number }) rows!: number;
}

export class PurgeResultDto {
  @ApiProperty({ type: () => [PurgeDeletionDto] })
  deleted!: PurgeDeletionDto[];

  @ApiProperty({ type: Number }) total!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Horodatage serveur de la purge.',
  })
  purgedAt!: string;
}
