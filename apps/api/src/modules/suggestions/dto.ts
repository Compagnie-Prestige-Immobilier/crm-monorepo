import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { SuggestionStatus } from '@crm/database';

import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';

export class SuggestionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;

  @ApiProperty({ format: 'uuid', description: 'Le représentant qui a donné le numéro.' })
  sourceRepresentantId!: string;

  @ApiProperty({
    description: 'Code court à six caractères du représentant qui a donné le numéro.',
  })
  sourceRepresentantShortCode!: string;

  @ApiProperty({ type: String, nullable: true }) suggestedName!: string | null;
  @ApiProperty({ description: 'Numéro normalisé par le serveur.' }) suggestedPhoneE164!: string;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;

  @ApiProperty({ enum: SuggestionStatus, enumName: 'SuggestionStatus' })
  status!: SuggestionStatus;

  @ApiProperty({ format: 'uuid', description: 'Téléconseiller qui a recueilli la suggestion.' })
  suggestedById!: string;

  @ApiProperty() suggestedByName!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Fiche existante portant ce numéro au moment de la saisie. La piste est déjà connue.',
  })
  resolvedRepresentantId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' }) clientCreatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class SuggestionListDto {
  @ApiProperty({ type: () => [SuggestionDto] }) items!: SuggestionDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export class SuggestionQueryDto {
  @ApiPropertyOptional({ enum: SuggestionStatus, enumName: 'SuggestionStatus' })
  @IsOptional()
  @IsEnum(SuggestionStatus)
  status?: SuggestionStatus;

  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class UpdateSuggestionStatusDto {
  @ApiProperty({ enum: SuggestionStatus, enumName: 'SuggestionStatus' })
  @IsEnum(SuggestionStatus)
  status!: SuggestionStatus;
}
