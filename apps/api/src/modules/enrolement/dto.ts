import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Projet } from '@crm/database';

import { queryBoolean } from '../../common/dto/query-boolean.js';
import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';

export { PageMetaDto };

/** Quinze minutes : le rythme auquel la cellule pilotage veut voir bouger l'écran. */
export const FREQUENCE_DEFAUT_MINUTES = 15;
export const FREQUENCE_MIN_MINUTES = 5;
export const FREQUENCE_MAX_MINUTES = 24 * 60;

export class DernierTirageDto {
  @ApiProperty({ type: String, format: 'date-time' }) termineLe!: string;
  @ApiProperty({ type: Number }) dureeMs!: number;
  @ApiProperty({ type: Number }) lus!: number;
  @ApiProperty({ type: Number }) crees!: number;
  @ApiProperty({ type: Number }) misAJour!: number;
  @ApiProperty({ type: Number }) rapproches!: number;
  @ApiProperty({
    type: Number,
    description: 'Inscriptions que la plateforme ne rend plus, marquées disparues par ce tirage.',
  })
  disparues!: number;
  @ApiProperty({ type: String, nullable: true }) erreur!: string | null;
}

export class EnrolementReglagesDto {
  @ApiProperty({ enum: Projet, enumName: 'Projet' }) projet!: Projet;

  @ApiProperty({ type: Number }) frequenceMinutes!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Ne garder que les inscriptions postérieures. Nulle, le tirage reprend tout l’historique.',
  })
  repriseDepuis!: string | null;

  @ApiProperty({
    type: Boolean,
    description: 'L’URL et le jeton de la plateforme sont posés dans l’environnement.',
  })
  configuree!: boolean;

  @ApiProperty({ type: () => DernierTirageDto, nullable: true })
  dernierTirage!: DernierTirageDto | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true }) updatedAt!: string | null;
}

export class UpdateEnrolementReglagesDto {
  // Pas de `default` ici : openapi-typescript rend obligatoire toute propriété
  // qui en porte un, et le champ deviendrait exigé à l'écriture.
  @ApiPropertyOptional({
    type: Number,
    minimum: FREQUENCE_MIN_MINUTES,
    maximum: FREQUENCE_MAX_MINUTES,
    description: `Absente, la fréquence reste inchangée. À l’usine : ${String(FREQUENCE_DEFAUT_MINUTES)} minutes.`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(FREQUENCE_MIN_MINUTES)
  @Max(FREQUENCE_MAX_MINUTES)
  frequenceMinutes?: number;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Chaîne vide pour reprendre tout l’historique.',
  })
  @IsOptional()
  @IsString()
  repriseDepuis?: string;
}

export class InscriptionPlateformeDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ enum: Projet, enumName: 'Projet' }) projet!: Projet;
  @ApiProperty({ type: String }) identifiantDistant!: string;
  @ApiProperty({ type: String }) nom!: string;
  @ApiProperty({ type: String }) prenom!: string;
  @ApiProperty({ type: String, nullable: true }) phoneE164!: string | null;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: String }) statutDistant!: string;
  @ApiProperty({ type: Number, nullable: true }) etapeDistante!: number | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) inscriteLe!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) soumiseLe!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) decideeLe!: string | null;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Date du tirage complet qui n’a plus trouvé cette inscription sur la plateforme.',
  })
  disparueLe!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) prospectId!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) dernierTirageAt!: string;
}

/** Le détail ajoute la charge utile brute : on relit une ligne sans ouvrir la plateforme. */
export class InscriptionPlateformeDetailDto extends InscriptionPlateformeDto {
  @ApiProperty({ type: Object, additionalProperties: true }) chargeUtile!: unknown;
}

export class InscriptionsPageDto {
  @ApiProperty({ type: () => [InscriptionPlateformeDto] }) items!: InscriptionPlateformeDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export class InscriptionsQueryDto {
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

  @ApiPropertyOptional({
    maxLength: 80,
    description: 'Statut distant, tel que la plateforme le rend.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  statut?: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Recherche libre sur le nom, l’e-mail ou le téléphone.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne basse sur la date d’inscription, incluse.',
  })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Borne haute sur la date d’inscription, incluse.',
  })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Vrai : seulement les inscriptions rapprochées d’un prospect. Faux : seulement celles qui ne le sont pas.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  rapproche?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Vrai : montrer aussi les inscriptions que la plateforme ne rend plus. Absente, elles sont masquées.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  inclureDisparues?: boolean;
}

export class TirageDto {
  @ApiProperty({ enum: Projet, enumName: 'Projet' }) projet!: Projet;
  @ApiProperty({ type: Number }) dureeMs!: number;
  @ApiProperty({ type: Number }) lus!: number;
  @ApiProperty({ type: Number }) crees!: number;
  @ApiProperty({ type: Number }) misAJour!: number;
  @ApiProperty({ type: Number }) rapproches!: number;
  @ApiProperty({ type: Number }) disparues!: number;
  @ApiProperty({ type: String, nullable: true }) erreur!: string | null;
}

export class SerieJourDto {
  @ApiProperty({ type: String, format: 'date' }) jour!: string;
  @ApiProperty({ type: Number }) inscriptions!: number;
}

export class RepartitionDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) label!: string;
  @ApiProperty({ type: Number }) inscriptions!: number;
}

export class DelaiMedianDto {
  @ApiProperty({ type: String }) leg!: string;
  @ApiProperty({ type: String }) label!: string;
  @ApiProperty({ type: Number, nullable: true }) medianDays!: number | null;
  @ApiProperty({ type: Number }) sample!: number;
}

export class EnrolementIndicateursDto {
  @ApiProperty({ enum: Projet, enumName: 'Projet' }) projet!: Projet;

  @ApiProperty({ type: Number }) inscriptions!: number;
  @ApiProperty({ type: Number }) rapprochees!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Prospects convertis du projet qui se retrouvent inscrits. Null quand aucun prospect n’est converti.',
  })
  tauxConversion!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Part des inscriptions rapprochées d’un prospect. Null quand rien n’est inscrit.',
  })
  tauxRapprochement!: number | null;

  @ApiProperty({ type: () => [SerieJourDto] }) parJour!: SerieJourDto[];
  @ApiProperty({ type: () => [RepartitionDto] }) parEtape!: RepartitionDto[];
  @ApiProperty({ type: () => [DelaiMedianDto] }) delais!: DelaiMedianDto[];
  @ApiProperty({ type: () => [RepartitionDto] }) parTeleconseiller!: RepartitionDto[];
  @ApiProperty({ type: () => [RepartitionDto] }) parCampagne!: RepartitionDto[];
  @ApiProperty({ type: () => [RepartitionDto] }) parMethode!: RepartitionDto[];
}
