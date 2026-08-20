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
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import type { FastifyReply } from 'fastify';
import { Role } from '@crm/database';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { programmeFilename, writeProgrammePdf } from '../phase2/programme-pdf.js';
import { REP_CHECKBOX_GROUPS, RepCampaignsService } from './rep-campaigns.service.js';
import {
  CreateRepCallAttemptDto,
  CreateRepCampaignDto,
  RepCallAttemptResultDto,
  RepCampaignDetailDto,
  RepCampaignListDto,
  RepCampaignPreviewDto,
  RepCampaignPreviewQueryDto,
  RepCampaignQueryDto,
  RepProgrammeQueryDto,
} from './dto.js';

const PDF_MIME = 'application/pdf';

@ApiTags('rep-campaigns')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'rep-campaigns', version: '1' })
export class RepCampaignsController {
  constructor(private readonly campaigns: RepCampaignsService) {}

  @Get('preview')
  @ApiOperation({
    operationId: 'previewRepCampaign',
    summary: 'Aperçu du tirage AVANT création : éligibles, charge par commercial et par jour.',
    description:
      'Créer une campagne fige des dizaines de milliers d’affectations et rend les représentants inéligibles à toute autre campagne. L’aperçu est ce qui permet de constater qu’un périmètre trop large donne une liasse intenable, avant de le découvrir sur le PDF.',
  })
  @ApiResponse({ status: 200, type: RepCampaignPreviewDto })
  preview(@Query() query: RepCampaignPreviewQueryDto): Promise<RepCampaignPreviewDto> {
    return this.campaigns.preview(query);
  }

  @Post('attempts')
  @Roles(Role.COMMERCIAL, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'recordRepCallAttempt',
    summary: 'Enregistre un appel passé à un représentant et clôt la tâche si l’issue aboutit.',
    description:
      'L’identifiant est engendré par le client et sert de clé d’idempotence : un envoi rejoué après une coupure réseau renvoie `duplicate` sans rien réécrire. Une tentative hors campagne est acceptée et conservée, parce qu’elle nourrit les statistiques de qualité de la base. `suggestedPhone` recueille, dans le même geste, le numéro qu’un représentant qui refuse propose d’appeler à sa place : la réponse dit si ce numéro est déjà une fiche connue.',
  })
  @ApiResponse({ status: 200, type: RepCallAttemptResultDto })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description:
      'REP_CAMPAIGN_COMMENT_REQUIRED · REP_CAMPAIGN_PROMISED_NOT_ALLOWED · PHONE_INVALID.',
  })
  @ApiResponse({
    status: 404,
    type: ApiErrorDto,
    description: 'REP_CAMPAIGN_REPRESENTANT_NOT_FOUND.',
  })
  recordAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateRepCallAttemptDto,
  ): Promise<RepCallAttemptResultDto> {
    return this.campaigns.recordAttempt(user, body);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({
    operationId: 'listRepCampaigns',
    summary: 'Liste des campagnes représentants, avec l’avancement de chacune.',
  })
  @ApiResponse({ status: 200, type: RepCampaignListDto })
  list(@Query() query: RepCampaignQueryDto): Promise<RepCampaignListDto> {
    return this.campaigns.list(query);
  }

  @Post()
  @ApiOperation({
    operationId: 'createRepCampaign',
    summary: 'Crée une campagne, tire les représentants éligibles et fige la répartition.',
    description:
      'Le tirage est mélangé par PostgreSQL à partir d’une graine persistée, puis réparti en tourniquet dans l’ordre des commerciaux fournis. `spreadDays` découpe ensuite la file de chaque commercial en tranches contiguës, une par journée.',
  })
  @ApiResponse({ status: 201, type: RepCampaignDetailDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'REP_CAMPAIGN_REPRESENTANT_ALREADY_ASSIGNED.',
  })
  @ApiResponse({
    status: 422,
    type: ApiErrorDto,
    description:
      'REP_CAMPAIGN_NO_ELIGIBLE_REPRESENTANT · REP_CAMPAIGN_COMMERCIAL_NOT_FOUND · ' +
      'REP_CAMPAIGN_NOT_A_COMMERCIAL · REP_CAMPAIGN_COMMERCIAL_INACTIVE. Requête ' +
      'bien formée, refusée par une règle métier.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateRepCampaignDto,
  ): Promise<RepCampaignDetailDto> {
    return this.campaigns.create(user, body);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({
    operationId: 'getRepCampaign',
    summary: 'Détail d’une campagne, ventilé par commercial et par journée.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: RepCampaignDetailDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'REP_CAMPAIGN_NOT_FOUND.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<RepCampaignDetailDto> {
    return this.campaigns.get(id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'closeRepCampaign',
    summary: 'Clôt la campagne et annule toutes les tâches encore ouvertes.',
    description:
      'Idempotent. Les tâches annulées redeviennent inactives : sans quoi leurs représentants resteraient inéligibles à toute campagne future.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: RepCampaignDetailDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'REP_CAMPAIGN_NOT_FOUND.' })
  close(@Param('id', ParseUUIDPipe) id: string): Promise<RepCampaignDetailDto> {
    return this.campaigns.close(id);
  }

  @Get(':id/commerciaux/:userId/programme.pdf')
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiProduces(PDF_MIME)
  @ApiOperation({
    operationId: 'downloadRepProgrammePdf',
    summary: 'Programme d’appels représentants, imprimable.',
    description:
      'Même maquette que le programme de prospection, seules changent les cases à cocher : le même commercial reçoit les deux liasses le même matin. AUCUN nom n’y figure, chaque ligne se rapproche de sa fiche par son code court.',
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
    description: 'REP_CAMPAIGN_PROGRAMME_NOT_FOUND · REP_CAMPAIGN_DAY_NOT_FOUND.',
    content: { 'application/json': { schema: { $ref: getSchemaPath(ApiErrorDto) } } },
  })
  async downloadProgramme(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: RepProgrammeQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const programme = await this.campaigns.programme(id, userId, query.jour);
    const generatedAt = new Date();

    reply.hijack();
    reply.raw.setHeader('Content-Type', PDF_MIME);
    reply.raw.setHeader(
      'Content-Disposition',
      `attachment; filename="${programmeFilename({
        generatedAt,
        ...(query.jour === undefined ? {} : { dayNumber: query.jour }),
      })}"`,
    );
    reply.raw.setHeader('Cache-Control', 'no-store');

    try {
      await writeProgrammePdf(reply.raw, {
        ...programme,
        generatedAt,
        title: 'Programme d’appels représentants',
        scopeCaption: 'Périmètre',
        checkboxGroups: REP_CHECKBOX_GROUPS,
      });
    } catch (error) {
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
