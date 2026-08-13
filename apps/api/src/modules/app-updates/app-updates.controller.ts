import { Controller, Get, ParseIntPipe, Post, Query, Req, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
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
  download(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    return this.updates.download(reply, request.headers.range);
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
