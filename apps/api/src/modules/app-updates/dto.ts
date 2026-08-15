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

  /**
   * `type: String` est OBLIGATOIRE ici, contrairement aux champs ci-dessus.
   *
   * Les métadonnées de conception (`design:type`) émises par TypeScript
   * réduisent l'union `string | null` à `Object` : sans type explicite, le
   * schéma publié n'a plus ni `type` ni `$ref`, et les générateurs produisent
   * `Record<string, never>` en TypeScript et `Object?` en Dart. Les notes de
   * version deviennent alors inaffichables sans transtypage manuel.
   *
   * `nullable` et non « optionnel » : le serveur envoie TOUJOURS la clé, avec
   * la valeur `null` quand aucune note n'accompagne la release. Un champ
   * déclaré optionnel ferait engendrer un type non-nullable côté Dart, et la
   * désérialisation échouerait sur le premier `null` reçu.
   */
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
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

  /**
   * Type explicite pour la même raison que `AppUpdateDto.notes` : ce champ est
   * le seul du formulaire dont la valeur peut être absente, et un jour où il
   * deviendrait `string | null` le schéma se dégraderait en silence.
   */
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}
