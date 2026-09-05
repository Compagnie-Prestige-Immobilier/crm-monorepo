import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export const URL_MAX_LENGTH = 500;
export const EMAIL_MAX_LENGTH = 254;
export const TELEPHONE_MAX_LENGTH = 40;
export const JETON_MAX_LENGTH = 500;

/**
 * Ce qu'un teleconseiller lit au prospect selon la methode retenue. Rien de
 * secret ici : ces trois valeurs sont faites pour etre dictees au telephone.
 */
export class ParametresPublicsDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Adresse de la plateforme d’enrôlement en ligne, dictée au prospect.',
  })
  plateformeUrl!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Adresse électronique CHUES à laquelle le prospect envoie son dossier.',
  })
  email!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Numéro WhatsApp de la cellule d’enrôlement qui recontacte le prospect.',
  })
  whatsappE164!: string | null;
}

/**
 * L'ecran d'administration. Les jetons ne sortent JAMAIS en clair : un GET dit
 * seulement s'ils sont poses, sinon la page les afficherait a qui sait ouvrir
 * un onglet reseau, et une capture d'ecran suffirait a les fuiter.
 */
export class ParametresChuesDto extends ParametresPublicsDto {
  @ApiProperty({ type: String, nullable: true }) chuesApiUrl!: string | null;
  @ApiProperty({ type: Boolean }) chuesApiTokenPose!: boolean;

  @ApiProperty({ type: String, nullable: true }) grandPublicApiUrl!: string | null;
  @ApiProperty({ type: Boolean }) grandPublicApiTokenPose!: boolean;

  @ApiProperty({
    type: Boolean,
    description:
      'Les réglages du connecteur viennent encore de l’environnement, faute d’avoir été ' +
      'saisis ici. Les poser en base les fait primer.',
  })
  heriteDeLEnvironnement!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true }) updatedAt!: string | null;
}

/**
 * Toute propriete absente laisse la valeur en place ; une chaine vide l'efface.
 * Sans cette distinction, un formulaire qui ne montre pas un champ l'effacerait
 * en l'omettant.
 */
export class UpdateParametresChuesDto {
  @ApiPropertyOptional({ type: String, maxLength: URL_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(URL_MAX_LENGTH)
  plateformeUrl?: string;

  @ApiPropertyOptional({ type: String, maxLength: EMAIL_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(EMAIL_MAX_LENGTH)
  @IsEmail({}, { message: 'L’adresse électronique CHUES n’est pas une adresse.' })
  email?: string;

  @ApiPropertyOptional({ type: String, maxLength: TELEPHONE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(TELEPHONE_MAX_LENGTH)
  whatsappE164?: string;

  @ApiPropertyOptional({ type: String, maxLength: URL_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(URL_MAX_LENGTH)
  chuesApiUrl?: string;

  @ApiPropertyOptional({ type: String, maxLength: JETON_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(JETON_MAX_LENGTH)
  chuesApiToken?: string;

  @ApiPropertyOptional({ type: String, maxLength: URL_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(URL_MAX_LENGTH)
  grandPublicApiUrl?: string;

  @ApiPropertyOptional({ type: String, maxLength: JETON_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(JETON_MAX_LENGTH)
  grandPublicApiToken?: string;
}
