import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
  @ApiPropertyOptional() notes!: string | null;
}

export class AppUpdateUploadDto {
  @ApiProperty({ description: 'Version visible par les utilisateurs, ex. 1.4.0.' })
  @IsString()
  @MaxLength(32)
  versionName!: string;

  @ApiProperty({ description: 'versionCode Android strictement positif.' })
  @IsInt()
  @Min(1)
  versionCode!: number;

  @ApiProperty({ description: 'Bloque l’application jusqu’à installation.' })
  @IsBoolean()
  forceUpdate!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}
