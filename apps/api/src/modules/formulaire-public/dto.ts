import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Ce qu'un visiteur envoie depuis le formulaire public. Aucun identifiant de
 * référentiel : personne d'extérieur ne connaît un UUID de banque.
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
    maxLength: 254,
    description: 'Sans adresse, la confirmation à l’écran vaut accusé de réception.',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  employeur?: string;

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
