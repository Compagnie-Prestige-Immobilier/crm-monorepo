import {
  Body,
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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Role } from '@crm/database';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Phase2CampaignsService } from './campaigns.service.js';
import { Phase2DirectoryService } from './directory.service.js';
import { CallOutcomeReasonsService } from '../referentiels/call-outcome-reasons.service.js';
import { programmeFilename, prospectCheckboxGroups, writeProgrammePdf } from './programme-pdf.js';
import {
  CampaignDetailDto,
  CampaignListDto,
  CampaignQueryDto,
  CreateCampaignDto,
  DirectoryPageDto,
  DirectoryQueryDto,
  ProgrammeQueryDto,
  CallRecordingDto,
} from './dto.js';
import { CallRecordingsService } from './recordings.service.js';
import { readEnv } from '../../env.js';

const PDF_MIME = 'application/pdf';

@ApiTags('phase2')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'phase2', version: '1' })
export class Phase2Controller {
  constructor(
    private readonly campaigns: Phase2CampaignsService,
    private readonly directory: Phase2DirectoryService,
    private readonly reasons: CallOutcomeReasonsService,
    private readonly recordings: CallRecordingsService,
  ) {}

  @Post('call-attempts/:id/recording')
  @Roles(Role.COMMERCIAL)
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
  @Roles(Role.COMMERCIAL, Role.ADMIN)
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

  @Get('campaigns')
  @Roles(Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({
    operationId: 'listCallCampaigns',
    summary: 'Liste des campagnes, avec l’avancement de chacune.',
  })
  @ApiResponse({ status: 200, type: CampaignListDto })
  listCampaigns(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CampaignQueryDto,
  ): Promise<CampaignListDto> {
    return this.campaigns.list(user, query);
  }

  @Post('campaigns')
  @Roles(Role.ADMIN)
  @ApiOperation({
    operationId: 'createCallCampaign',
    summary: 'Crée une campagne, tire l’ensemble éligible et fige la répartition.',
    description:
      'Le tirage est mélangé par PostgreSQL à partir d’une graine persistée, puis réparti en tourniquet dans l’ordre des commerciaux fournis. Les affectations sont matérialisées : consulter la campagne ou retélécharger un PDF ne retire jamais au sort.',
  })
  @ApiResponse({ status: 201, type: CampaignDetailDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description:
      'PHASE2_PROSPECT_ALREADY_ASSIGNED, une campagne concurrente a pris les mêmes prospects.',
  })
  @ApiResponse({
    status: 422,
    type: ApiErrorDto,
    description:
      'PHASE2_NO_ELIGIBLE_PROSPECT · PHASE2_COMMERCIAL_NOT_FOUND · ' +
      'PHASE2_NOT_A_COMMERCIAL · PHASE2_COMMERCIAL_INACTIVE. Requête bien formée, ' +
      'refusée par une règle métier.',
  })
  createCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCampaignDto,
  ): Promise<CampaignDetailDto> {
    return this.campaigns.create(user, body);
  }

  @Get('campaigns/:id')
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({
    operationId: 'getCallCampaign',
    summary: 'Détail d’une campagne, ventilé par commercial.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CampaignDetailDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'PHASE2_CAMPAIGN_NOT_FOUND.' })
  getCampaign(@Param('id', ParseUUIDPipe) id: string): Promise<CampaignDetailDto> {
    return this.campaigns.get(id);
  }

  @Post('campaigns/:id/close')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'closeCallCampaign',
    summary: 'Clôt la campagne et annule toutes les tâches encore ouvertes.',
    description:
      'Idempotent. Les tâches annulées redeviennent inactives : sans quoi leurs prospects resteraient inéligibles à toute campagne future.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CampaignDetailDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'PHASE2_CAMPAIGN_NOT_FOUND.' })
  closeCampaign(@Param('id', ParseUUIDPipe) id: string): Promise<CampaignDetailDto> {
    return this.campaigns.close(id);
  }

  @Get('campaigns/:id/commerciaux/:userId/programme.pdf')
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiProduces(PDF_MIME)
  @ApiOperation({
    operationId: 'downloadCallProgrammePdf',
    summary: 'Programme d’appels imprimable d’un commercial.',
    description:
      'Ordre identique aux positions persistées. AUCUN nom de prospect n’y figure : chaque ligne se rapproche de sa fiche par son code court à six caractères. Le paramètre `jour` restreint la liasse à une journée d’étalement ; sans lui, tout le programme est rendu.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Document PDF, en flux.',
    content: { [PDF_MIME]: { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiResponse({
    status: 404,
    description: 'PHASE2_CAMPAIGN_COMMERCIAL_NOT_FOUND · PHASE2_CAMPAIGN_DAY_NOT_FOUND.',
    content: { 'application/json': { schema: { $ref: getSchemaPath(ApiErrorDto) } } },
  })
  async downloadProgramme(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ProgrammeQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const programme = await this.campaigns.programme(id, userId, query.jour);
    const reasons = await this.reasons.listAll();
    const generatedAt = new Date();

    reply.hijack();
    reply.raw.setHeader('Content-Type', PDF_MIME);
    reply.raw.setHeader(
      'Content-Disposition',
      `attachment; filename="${programmeFilename({ generatedAt, ...(query.jour === undefined ? {} : { dayNumber: query.jour }) })}"`,
    );
    reply.raw.setHeader('Cache-Control', 'no-store');

    try {
      await writeProgrammePdf(reply.raw, {
        ...programme,
        generatedAt,
        checkboxGroups: prospectCheckboxGroups(reasons.items.filter((reason) => reason.isActive)),
      });
    } catch (error) {
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
