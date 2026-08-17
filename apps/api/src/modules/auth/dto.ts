import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Role } from '@crm/database';

export class LoginDto {
  @ApiProperty({
    description: 'Adresse e-mail OU nom d’utilisateur. Le serveur essaie les deux.',
    example: 'admin@cpi.sn',
    maxLength: 254,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  identifier!: string;

  @ApiProperty({ minLength: 8, maxLength: 200, format: 'password' })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Le refresh token reçu au login ou au refresh précédent.' })
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  refreshToken!: string;
}

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() username!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: Role, enumName: 'Role' }) role!: Role;
  @ApiProperty() isActive!: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  departementId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  phoneE164!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lastLoginAt!: string | null;
}

export class AuthTokensDto {
  @ApiProperty({ description: 'JWT à placer dans l’en-tête Authorization: Bearer.' })
  accessToken!: string;

  @ApiProperty({ description: 'À conserver côté client ; tourné à chaque usage.' })
  refreshToken!: string;

  @ApiProperty({ type: Number, description: 'Durée de vie de l’access token, en secondes.' })
  expiresIn!: number;

  @ApiProperty({ type: () => AuthUserDto })
  user!: AuthUserDto;
}

export class LogoutResponseDto {
  @ApiProperty({ type: Boolean }) revoked!: boolean;
}

export class RoleFilterDto {
  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
