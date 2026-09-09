import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Un lien vide est permis : il vaut « pas encore renseigne », pas « n'importe quoi ». */
const LIEN = { require_tld: true, protocols: ['https'], require_protocol: true };

export class ParametresChuesDto {
  @ApiProperty() plateformeChuesUrl!: string;
  @ApiProperty() plateformeGrandPublicUrl!: string;
  @ApiProperty() emailChues!: string;
  @ApiProperty() whatsappChuesE164!: string;
  @ApiProperty() messageWhatsapp!: string;
  @ApiProperty() accuseReceptionObjet!: string;
  @ApiProperty() accuseReceptionCorps!: string;
  @ApiProperty({ type: [String] }) destinatairesEnrolement!: string[];
  @ApiProperty({ type: [String] }) destinatairesBpe!: string[];
  @ApiProperty({ type: [String] }) destinatairesSupervision!: string[];
  @ApiProperty({ type: [String] }) destinatairesDirection!: string[];
  @ApiProperty() verrouFiches!: boolean;
}

/**
 * Tout est facultatif : l'ecran n'envoie que ce qu'il a change, et le
 * superviseur n'a le droit d'envoyer que les deux textes. Un corps qui
 * porterait les onze champs ferait echouer sa moindre correction.
 */
export class UpdateParametresChuesDto {
  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsUrl(LIEN)
  plateformeChuesUrl?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsUrl(LIEN)
  plateformeGrandPublicUrl?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsEmail()
  emailChues?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsappChuesE164?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  messageWhatsapp?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  accuseReceptionObjet?: string;

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  accuseReceptionCorps?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true })
  destinatairesEnrolement?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true })
  destinatairesBpe?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true })
  destinatairesSupervision?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true })
  destinatairesDirection?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  verrouFiches?: boolean;
}

export class ParametreChangementDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() cle!: string;
  @ApiProperty({ type: String, nullable: true }) ancienne!: string | null;
  @ApiProperty() nouvelle!: string;
  @ApiProperty() parNom!: string;
  @ApiProperty() le!: string;
}

export class JournalParametresQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite?: number;
}

export class JournalParametresDto {
  @ApiProperty({ type: () => [ParametreChangementDto] }) items!: ParametreChangementDto[];
}
