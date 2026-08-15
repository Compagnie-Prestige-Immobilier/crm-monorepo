import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Role } from '@crm/database';

import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';
import { queryBoolean } from '../../common/dto/query-boolean.js';

export class CreateUserDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    minLength: 3,
    maxLength: 40,
    description: 'Identifiant de connexion alternatif : lettres, chiffres, point, tiret bas.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username ne peut contenir que lettres, chiffres, point, tiret et tiret bas',
  })
  username!: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ minLength: 12, maxLength: 200, format: 'password' })
  @IsString()
  @MinLength(12, { message: 'Le mot de passe doit faire au moins 12 caractères' })
  @MaxLength(200)
  password!: string;

  @ApiPropertyOptional({ enum: Role, enumName: 'Role', default: Role.COMMERCIAL })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departementId?: string;

  @ApiPropertyOptional({ description: 'Téléphone, normalisé en E.164 par le serveur.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

/**
 * Tous les champs de création sauf le mot de passe : le réinitialiser passe par
 * `PUT /users/:id/password`, pour qu'un PATCH de profil ne puisse pas changer
 * un mot de passe par inadvertance.
 */
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const)) {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @ApiProperty({ minLength: 12, maxLength: 200, format: 'password' })
  @IsString()
  @MinLength(12)
  @MaxLength(200)
  password!: string;
}

export class SetActiveDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  isActive!: boolean;
}

export class UserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() username!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: Role, enumName: 'Role' }) role!: Role;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) departementId!: string | null;
  @ApiProperty({ type: String, nullable: true }) departementName!: string | null;
  @ApiProperty({ type: String, nullable: true }) phoneE164!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastLoginAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: Number, description: 'Nombre de prospects saisis par ce commercial.' })
  prospectCount!: number;
}

export class UserListQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

export class UserListDto {
  // `type: () => [UserDto]` est obligatoire : la réflexion TypeScript ne voit
  // pas le type des éléments d'un tableau, et sans cette annotation le client
  // Dart généré reçoit une List<dynamic>.
  @ApiProperty({ type: () => [UserDto] })
  items!: UserDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}
