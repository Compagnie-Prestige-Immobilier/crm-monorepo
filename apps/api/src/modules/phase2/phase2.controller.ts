import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Role } from '@crm/database';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { PARCOURS_ROLES, Roles } from '../../common/decorators/roles.decorator.js';
import { Phase2DirectoryService } from './directory.service.js';
import { DirectoryPageDto, DirectoryQueryDto, CallRecordingDto } from './dto.js';
import { CallRecordingsService } from './recordings.service.js';
import { readEnv } from '../../env.js';

@ApiTags('phase2')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'phase2', version: '1' })
export class Phase2Controller {
  constructor(
    private readonly directory: Phase2DirectoryService,
    private readonly recordings: CallRecordingsService,
  ) {}

  @Post('call-attempts/:id/recording')
  @Roles(...PARCOURS_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    operationId: 'uploadCallRecording',
    summary: 'Joint une note audio à une tentative déjà synchronisée.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CallRecordingDto })
  async uploadRecording(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: FastifyRequest,
  ): Promise<CallRecordingDto> {
    const maxBytes = readEnv().CALL_RECORDING_MAX_SIZE_BYTES;
    return this.recordings.upload(
      user,
      id,
      await request.file({ limits: { fileSize: maxBytes, files: 1 } }),
    );
  }

  @Get('call-attempts/:id/recording')
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION, Role.COMMERCIAL)
  @ApiProduces('audio/mp4')
  @ApiOperation({
    operationId: 'downloadCallRecording',
    summary: 'Lit la note audio jointe à une tentative.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 200,
    content: { 'audio/mp4': { schema: { type: 'string', format: 'binary' } } },
  })
  async downloadRecording(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const recording = await this.recordings.open(user, id);
    reply.header('Content-Type', 'audio/mp4');
    reply.header('Content-Length', String(recording.bytes));
    reply.header('Cache-Control', 'private, max-age=3600');
    await reply.send(recording.stream);
  }

  @Get('directory')
  @Roles(...PARCOURS_ROLES)
  @ApiOperation({
    operationId: 'pullPhase2Directory',
    summary: 'Annuaire hors ligne : téléphone et état de phase 2, rien d’autre.',
    description:
      'Pagination keyset sur (updatedAt, id), page de 2 000 par défaut, retard de sécurité de 2 secondes. Chaque entrée porte exactement six champs : ni nom, ni banque, ni syndicat.',
  })
  @ApiResponse({ status: 200, type: DirectoryPageDto })
  @ApiResponse({ status: 400, type: ApiErrorDto, description: 'PHASE2_DIRECTORY_CURSOR_INVALID.' })
  pullDirectory(@Query() query: DirectoryQueryDto): Promise<DirectoryPageDto> {
    return this.directory.pull(query);
  }

}
