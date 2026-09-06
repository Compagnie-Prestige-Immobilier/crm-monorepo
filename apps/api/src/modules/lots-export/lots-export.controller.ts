import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
} from '@nestjs/swagger';
import { Role } from '@crm/database';
import type { FastifyReply } from 'fastify';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { PARCOURS_ROLES, Roles } from '../../common/decorators/roles.decorator.js';
import { setDemoHeader } from '../export/demo-marking.js';
import { WorkspaceContext } from '../../workspaces/workspace.js';
import {
  CreateLotExportDto,
  LotExportDetailDto,
  LotExportFichesDto,
  LotExportFichesQueryDto,
  LotExportListDto,
  LotExportPreviewDto,
  LotExportProgrammeQueryDto,
  LotExportQueryDto,
  LotExportSummaryDto,
  MesAttributionsDto,
  ReaffecterLotExportDto,
  RetirerTeleconseillerDto,
  UpdateLotExportDto,
} from './dto.js';
import { LotsExportService } from './lots-export.service.js';
import { programmeFilename } from './programme-pdf.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('lots-export')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'lots-export', version: '1' })
export class LotsExportController {
  constructor(
    private readonly lots: LotsExportService,
    private readonly workspace: WorkspaceContext,
  ) {}
  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISEUR)
  @ApiOperation({ operationId: 'createLotExport', summary: 'Crée une campagne de fiches.' })
  @ApiResponse({ status: 201, type: LotExportSummaryDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateLotExportDto,
  ): Promise<LotExportSummaryDto> {
    return this.lots.create(user, body);
  }
  // En GET, l'analyseur de requête de Fastify est plat : `prospects[projet]=CHUES`
  // arrive comme une clé littérale et la validation la rejette. L'aperçu prend
  // donc les mêmes critères imbriqués que la création, dans un corps.
  @Post('apercu')
  @HttpCode(200)
  @Roles(Role.ADMIN, Role.SUPERVISEUR)
  @ApiOperation({ operationId: 'previewLotExport', summary: 'Compte les fiches d’une cible.' })
  @ApiResponse({ status: 200, type: LotExportPreviewDto })
  preview(@Body() body: CreateLotExportDto): Promise<LotExportPreviewDto> {
    return this.lots.preview(body);
  }
  @Get()
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({ operationId: 'listLotsExport', summary: 'Liste les campagnes.' })
  @ApiResponse({ status: 200, type: LotExportListDto })
  list(@Query() query: LotExportQueryDto): Promise<LotExportListDto> {
    return this.lots.list(query);
  }
  @Get(':id/export.xlsx')
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({
    operationId: 'downloadLotExportXlsx',
    summary: 'Télécharge le classeur figé de la campagne.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 200,
    content: { [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } } },
  })
  async xlsx(@Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply): Promise<void> {
    reply.hijack();
    reply.raw.setHeader('Content-Type', XLSX_MIME);
    reply.raw.setHeader('Content-Disposition', `attachment; filename="campagne-${id}.xlsx"`);
    reply.raw.setHeader('Cache-Control', 'no-store');
    setDemoHeader(reply.raw, this.workspace.current() === 'demo');
    await this.lots.writeXlsx(id, reply.raw);
  }
  @Get(':id/programme.pdf')
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiProduces('application/pdf')
  @ApiOperation({
    operationId: 'downloadLotExportProgramme',
    summary: 'Télécharge le programme d’un téléconseiller pour une journée.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 200,
    content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
  })
  async programme(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LotExportProgrammeQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    // Le programme est assemblé AVANT le détournement : une réponse détournée
    // ne saurait plus porter le 404 du couple téléconseiller / journée.
    const data = await this.lots.programme(id, query.teleconseillerId, query.jour);
    reply.hijack();
    reply.raw.setHeader('Content-Type', 'application/pdf');
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${programmeFilename(data)}"`);
    reply.raw.setHeader('Cache-Control', 'no-store');
    await this.lots.writeProgramme(data, reply.raw);
  }
  @Get(':id/programmes.zip')
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiProduces('application/zip')
  @ApiOperation({
    operationId: 'downloadLotExportProgrammesZip',
    summary: 'Télécharge tous les programmes de la campagne.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 200,
    content: { 'application/zip': { schema: { type: 'string', format: 'binary' } } },
  })
  async programmesZip(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const archive = await this.lots.programmesZip(id);
    reply.hijack();
    reply.raw.setHeader('Content-Type', 'application/zip');
    reply.raw.setHeader(
      'Content-Disposition',
      `attachment; filename="campagne-${id}-programmes.zip"`,
    );
    reply.raw.setHeader('Content-Length', archive.byteLength);
    reply.raw.setHeader('Cache-Control', 'no-store');
    reply.raw.end(archive);
  }
  // AVANT `:id` : une route statique déclarée après serait masquée par le paramètre.
  @Get('mes-attributions')
  @Roles(...PARCOURS_ROLES)
  @ApiOperation({
    operationId: 'mesAttributions',
    summary: 'Les fiches attribuées à l’appelant, tous lots confondus.',
    description:
      'Sert au mobile à borner son tirage. `tout: true` pour ADMIN seulement : les deux listes sont alors vides et aucun filtre ne s’applique. Supervision et direction ne voient sur le téléphone que les fiches qu’une campagne leur a confiées.',
  })
  @ApiResponse({ status: 200, type: MesAttributionsDto })
  mesAttributions(@CurrentUser() user: AuthenticatedUser): Promise<MesAttributionsDto> {
    return this.lots.mesAttributions(user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({
    operationId: 'getLotExport',
    summary: 'Consulte une campagne et les appels qui ont suivi.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: LotExportDetailDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<LotExportDetailDto> {
    return this.lots.get(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPERVISEUR)
  @ApiOperation({
    operationId: 'updateLotExport',
    summary: 'Renomme une campagne et règle les objectifs.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: LotExportSummaryDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'LOT_EXPORT_NOT_FOUND.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateLotExportDto,
  ): Promise<LotExportSummaryDto> {
    return this.lots.update(id, body);
  }

  @Get(':id/fiches')
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({
    operationId: 'listLotExportFiches',
    summary: 'Liste les fiches d’une campagne, avec leur état et le statut posé.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: LotExportFichesDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'LOT_EXPORT_NOT_FOUND.' })
  fiches(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LotExportFichesQueryDto,
  ): Promise<LotExportFichesDto> {
    return this.lots.fiches(id, query);
  }

  @Post(':id/reaffectation')
  @HttpCode(200)
  @Roles(Role.ADMIN, Role.SUPERVISEUR)
  @ApiOperation({
    operationId: 'reaffecterLotExport',
    summary: 'Confie des fiches non traitées à un autre téléconseiller.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: LotExportDetailDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'LOT_EXPORT_NOT_FOUND.' })
  reaffecter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReaffecterLotExportDto,
  ): Promise<LotExportDetailDto> {
    return this.lots.reaffecter(user, id, body);
  }

  @Post(':id/retrait')
  @HttpCode(200)
  @Roles(Role.ADMIN, Role.SUPERVISEUR)
  @ApiOperation({
    operationId: 'retirerTeleconseillerLotExport',
    summary: 'Retire un téléconseiller et redistribue ses fiches non traitées.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: LotExportDetailDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'LOT_EXPORT_NOT_FOUND.' })
  retirer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RetirerTeleconseillerDto,
  ): Promise<LotExportDetailDto> {
    return this.lots.retirer(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.ADMIN)
  @ApiOperation({
    operationId: 'deleteLotExport',
    summary: 'Supprime une campagne et sa répartition.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Campagne supprimée.' })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'LOT_EXPORT_NOT_FOUND.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.lots.remove(id);
  }
}
