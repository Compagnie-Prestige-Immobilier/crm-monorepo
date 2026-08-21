import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { seconds, Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { AuthService } from './auth.service.js';
import {
  AuthTokensDto,
  AuthUserDto,
  LoginDto,
  LogoutResponseDto,
  RefreshDto,
  SwitchWorkspaceDto,
} from './dto.js';
import { ANY_AUTHENTICATED, Roles } from '../../common/decorators/roles.decorator.js';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: seconds(60), limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'login',
    summary: 'Ouvre une session à partir d’un e-mail ou d’un nom d’utilisateur.',
  })
  @ApiResponse({ status: 200, type: AuthTokensDto })
  @ApiResponse({
    status: 401,
    type: ApiErrorDto,
    description: 'Identifiants invalides ou compte désactivé.',
  })
  @ApiResponse({
    status: 429,
    type: ApiErrorDto,
    description: 'Trop de tentatives (AUTH_LOGIN_RATE_LIMIT).',
  })
  login(@Body() body: LoginDto, @Headers('user-agent') userAgent?: string): Promise<AuthTokensDto> {
    return this.auth.login(body.identifier, body.password, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'refreshSession',
    summary: 'Échange un refresh token contre un nouveau couple de jetons.',
    description:
      'Le jeton présenté est révoqué au passage. Présenter un jeton déjà consommé révoque toute la famille.',
  })
  @ApiResponse({ status: 200, type: AuthTokensDto })
  @ApiResponse({ status: 401, type: ApiErrorDto, description: 'Jeton inconnu, expiré ou rejoué.' })
  refresh(
    @Body() body: RefreshDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthTokensDto> {
    return this.auth.refresh(body.refreshToken, userAgent);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'logout',
    summary: 'Révoque la famille de refresh tokens de l’appareil.',
  })
  @ApiResponse({ status: 200, type: LogoutResponseDto })
  async logout(@Body() body: RefreshDto): Promise<LogoutResponseDto> {
    return { revoked: await this.auth.logout(body.refreshToken) };
  }

  @Get('me')
  @Roles(...ANY_AUTHENTICATED)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'getCurrentUser', summary: 'Profil de l’utilisateur authentifié.' })
  @ApiResponse({ status: 200, type: AuthUserDto })
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserDto> {
    return this.auth.me(user.id, user.workspace ?? 'public');
  }

  @Post('workspace')
  @Roles(...ANY_AUTHENTICATED)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'switchWorkspace', summary: 'Change d’espace de travail.' })
  @ApiResponse({ status: 200, type: AuthTokensDto })
  switchWorkspace(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SwitchWorkspaceDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthTokensDto> {
    return this.auth.switchWorkspace(user.id, body.workspace, userAgent);
  }
}
