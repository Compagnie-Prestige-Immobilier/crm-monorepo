import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AppUpdateDto {
  @ApiProperty() available!: boolean;

  @ApiProperty({ description: 'Le poste est sous le plancher obligatoire.' })
  forceUpdate!: boolean;

  @ApiProperty() versionName!: string;
  @ApiProperty() versionCode!: number;
  @ApiProperty() fileName!: string;
  @ApiProperty() fileSize!: number;
  @ApiProperty() sha256!: string;

  @ApiProperty({ description: 'Empreinte SHA-256 du certificat signataire de l’APK servi.' })
  signerSha256!: string;

  @ApiProperty() downloadUrl!: string;
  @ApiProperty() publishedAt!: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Plus haut versionCode obligatoire encore en ligne, ou null.',
  })
  minVersionCode!: number | null;

  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
}

export class AndroidReleaseDto {
  @ApiProperty() versionCode!: number;
  @ApiProperty() versionName!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty() fileSize!: number;
  @ApiProperty() sha256!: string;
  @ApiProperty() signerSha256!: string;
  @ApiProperty() mandatory!: boolean;
  @ApiProperty() publishedAt!: string;

  @ApiProperty({ type: String, nullable: true }) publishedById!: string | null;
  @ApiProperty({ type: String, nullable: true }) publishedByName!: string | null;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ type: String, nullable: true }) withdrawnAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) withdrawnById!: string | null;
}

export class AndroidReleaseListDto {
  @ApiProperty({ type: [AndroidReleaseDto] }) items!: AndroidReleaseDto[];

  @ApiProperty({ type: Number, nullable: true }) minVersionCode!: number | null;
}

export class AppUpdateUploadDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}
