import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class AppUpdateDto {
  @ApiProperty() available!: boolean;
  @ApiProperty() forceUpdate!: boolean;
  @ApiProperty() versionName!: string;
  @ApiProperty() versionCode!: number;
  @ApiProperty() fileName!: string;
  @ApiProperty() fileSize!: number;
  @ApiProperty() sha256!: string;
  @ApiProperty() downloadUrl!: string;
  @ApiProperty() publishedAt!: string;

  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
}

export class AppUpdateUploadDto {
  @ApiProperty({ description: 'Bloque l’application jusqu’à installation.' })
  @IsBoolean()
  forceUpdate!: boolean;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}
