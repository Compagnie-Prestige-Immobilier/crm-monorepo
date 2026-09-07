import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaymentMode, ProspectType, WhatsappStatus } from '@crm/database';

import { ChampLibreDto, ReglageChampDto } from '../champs-conversion/dto.js';
import { DUREE_ETABLISSEMENT_MAX_MOIS, EMAIL_MAX_LENGTH } from '../phase2/attempt-rules.js';

/**
 * Ce qu'un visiteur envoie depuis le formulaire public. Les clés sont celles du
 * catalogue de la conversion (EB-28), à `phone` près : le visiteur saisit un
 * numéro libre, le serveur en fait la clé `phoneE164`.
 *
 * Tout est facultatif hormis l'identité et le numéro. Ce qui est réellement
 * exigé vient des réglages de l'administrateur, pas du type : un champ masqué
 * puis envoyé quand même est ignoré, jamais refusé.
 */
export class DemandePubliqueDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nom!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  prenom!: string;

  @ApiProperty({ maxLength: 40, description: 'Saisie libre, normalisé en E.164 par le serveur.' })
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone!: string;

  @ApiPropertyOptional({
    maxLength: EMAIL_MAX_LENGTH,
    description:
      'Sans adresse, la confirmation à l’écran vaut accusé de réception. Sert aussi à ' +
      'rapprocher la demande d’une fiche existante quand le numéro est inconnu.',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Profession choisie dans la liste rendue par `GET /formulaire`.',
  })
  @IsOptional()
  @IsUUID()
  professionId?: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Conservé pour les pages déjà en ligne. `professionId` le remplace.',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string;

  @ApiPropertyOptional({ maxLength: 160, description: 'Établissement où le visiteur exerce.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  etablissement?: string;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Conservé pour les pages déjà en ligne. `etablissement` le remplace.',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  employeur?: string;

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: DUREE_ETABLISSEMENT_MAX_MOIS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DUREE_ETABLISSEMENT_MAX_MOIS)
  dureeEtablissementMois?: number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  fonctionnaire?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  engagementEnCours?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'Identifiant rendu par `GET /formulaire`.' })
  @IsOptional()
  @IsUUID()
  syndicatId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Identifiant rendu par `GET /formulaire`.' })
  @IsOptional()
  @IsUUID()
  banqueId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Identifiant rendu par `GET /formulaire`.' })
  @IsOptional()
  @IsUUID()
  incomeBandId?: string;

  @ApiPropertyOptional({ enum: ProspectType, enumName: 'ProspectType' })
  @IsOptional()
  @IsEnum(ProspectType)
  type?: ProspectType;

  @ApiPropertyOptional({ enum: PaymentMode, enumName: 'PaymentMode' })
  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 300 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  dureeSystemeMois?: number;

  @ApiPropertyOptional({ enum: WhatsappStatus, enumName: 'WhatsappStatus' })
  @IsOptional()
  @IsEnum(WhatsappStatus)
  whatsappStatus?: WhatsappStatus;

  @ApiPropertyOptional({ maxLength: 40, description: 'Exigé quand le statut vaut AUTRE_NUMERO.' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  whatsappE164?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Réponses aux champs ajoutés par l’administrateur, par identifiant de champ.',
  })
  @IsOptional()
  @IsObject()
  champsLibres?: Record<string, string>;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  // Piège à robots : le champ est caché à l'écran, un automate le remplit.
  @ApiPropertyOptional({ maxLength: 200, description: 'Laisser vide.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  site?: string;

  @ApiPropertyOptional({
    maxLength: 2048,
    description: 'Jeton rendu par le widget Cloudflare Turnstile de la page.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  turnstileToken?: string;
}

/** Une entrée de référentiel réduite à ce qu'une liste déroulante affiche. */
export class OptionPubliqueDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() libelle!: string;
}

/** Une tranche d'ancienneté proposée au visiteur. `mois` en est la borne basse. */
export class TrancheDureeDto {
  @ApiProperty({ type: Number, minimum: 0 }) mois!: number;
  @ApiProperty() libelle!: string;
}

export class FormulairePublicDto {
  @ApiProperty({
    type: () => [ReglageChampDto],
    description:
      'Champs à rendre, dans l’ordre d’affichage, réglés par l’administrateur (EB-28). ' +
      'La méthode d’enrôlement et la date de rendez-vous en sont retirées : elles closent ' +
      'un dossier et n’appartiennent qu’au téléconseiller.',
  })
  champs!: ReglageChampDto[];

  @ApiProperty({ type: () => [ChampLibreDto] }) libres!: ChampLibreDto[];

  @ApiProperty({ type: () => [OptionPubliqueDto] }) banques!: OptionPubliqueDto[];
  @ApiProperty({ type: () => [OptionPubliqueDto] }) syndicats!: OptionPubliqueDto[];

  @ApiProperty({ type: () => [OptionPubliqueDto], description: 'Tranches de revenu mensuel.' })
  revenus!: OptionPubliqueDto[];

  @ApiProperty({ type: () => [OptionPubliqueDto] }) professions!: OptionPubliqueDto[];

  @ApiProperty({
    type: () => [TrancheDureeDto],
    description:
      'Tranches proposées pour `dureeEtablissementMois`, la valeur à envoyer étant `mois`.',
  })
  dureesEtablissement!: TrancheDureeDto[];
}
