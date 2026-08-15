import { Controller, Get, ParseIntPipe, Post, Query, Req, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { Role } from '@crm/database';
import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AppUpdatesService } from './app-updates.service.js';
import { AppUpdateDto } from './dto.js';

@ApiTags('app-updates')
@Controller({ path: 'app-updates', version: '1' })
export class AppUpdatesController {
  constructor(private readonly updates: AppUpdatesService) {}

  @Public()
  @Get('android/current')
  @ApiOperation({
    operationId: 'getAndroidUpdate',
    summary: 'Vérifie la dernière release Android.',
  })
  @ApiQuery({ name: 'versionCode', required: true, type: Number })
  @ApiResponse({ status: 200, type: AppUpdateDto })
  current(@Query('versionCode', ParseIntPipe) versionCode: number): Promise<AppUpdateDto> {
    return this.updates.current(versionCode);
  }

  @Public()
  @Get('android/download')
  @ApiOperation({
    operationId: 'downloadAndroidUpdate',
    summary: 'Télécharge la dernière release Android.',
  })
  @ApiProduces('application/vnd.android.package-archive')
  @ApiResponse({
    status: 200,
    content: {
      'application/vnd.android.package-archive': { schema: { type: 'string', format: 'binary' } },
    },
  })
  // Les reprises de téléchargement font partie du contrat de cette route : le
  // DownloadManager Android renvoie un `Range`, le service répond 206, et une
  // plage impossible à satisfaire donne 416.
  @ApiResponse({ status: 206, description: 'Reprise de téléchargement (en-tête Range).' })
  @ApiResponse({
    status: 416,
    description: 'Plage demandée hors du fichier.',
    // `@ApiProduces` s'applique à TOUTES les réponses de la route, y compris
    // aux erreurs : sans ce `content` explicite, le contrat annonçait un corps
    // d'erreur servi en APK, alors qu'une erreur sort toujours en JSON. Les
    // générateurs en tiraient un désérialiseur incapable de lire le refus.
    content: { 'application/json': { schema: { $ref: getSchemaPath(ApiErrorDto) } } },
  })
  download(@Res() reply: FastifyReply): Promise<void> {
    return this.updates.download(reply);
  }

  @Post('android')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ operationId: 'uploadAndroidUpdate', summary: 'Publie une release Android.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'versionName', 'versionCode', 'forceUpdate'],
      properties: {
        file: { type: 'string', format: 'binary' },
        versionName: { type: 'string' },
        versionCode: { type: 'integer' },
        forceUpdate: { type: 'boolean' },
        notes: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, type: AppUpdateDto })
  upload(
    @Req() request: FastifyRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AppUpdateDto> {
    return this.updates.upload(request, user);
  }
}
