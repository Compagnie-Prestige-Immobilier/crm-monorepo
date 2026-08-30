import {
  Body,
  Controller,
  Get,
  HttpCode,
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
} from '@nestjs/swagger';
import { Role } from '@crm/database';
import type { FastifyReply } from 'fastify';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { setDemoHeader } from '../export/demo-marking.js';
import { WorkspaceContext } from '../../workspaces/workspace.js';
import {
  CreateLotExportDto,
  LotExportDetailDto,
  LotExportListDto,
  LotExportPreviewDto,
  LotExportProgrammeQueryDto,
  LotExportQueryDto,
  LotExportSummaryDto,
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
  @Roles(Role.ADMIN)
  @ApiOperation({ operationId: 'createLotExport', summary: 'Crée un lot de fiches exportées.' })
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
  @Roles(Role.ADMIN)
  @ApiOperation({ operationId: 'previewLotExport', summary: 'Compte les fiches d’une cible.' })
  @ApiResponse({ status: 200, type: LotExportPreviewDto })
  preview(@Body() body: CreateLotExportDto): Promise<LotExportPreviewDto> {
    return this.lots.preview(body);
  }
  @Get()
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({ operationId: 'listLotsExport', summary: 'Liste les lots d’export.' })
  @ApiResponse({ status: 200, type: LotExportListDto })
  list(@Query() query: LotExportQueryDto): Promise<LotExportListDto> {
    return this.lots.list(query);
  }
  @Get(':id/export.xlsx')
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({
    operationId: 'downloadLotExportXlsx',
    summary: 'Télécharge le classeur figé du lot.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 200,
    content: { [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } } },
  })
  async xlsx(@Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply): Promise<void> {
    reply.hijack();
    reply.raw.setHeader('Content-Type', XLSX_MIME);
    reply.raw.setHeader('Content-Disposition', `attachment; filename="lot-${id}.xlsx"`);
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
    summary: 'Télécharge tous les programmes du lot.',
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
    reply.raw.setHeader('Content-Disposition', `attachment; filename="lot-${id}-programmes.zip"`);
    reply.raw.setHeader('Content-Length', archive.byteLength);
    reply.raw.setHeader('Cache-Control', 'no-store');
    reply.raw.end(archive);
  }
  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({
    operationId: 'getLotExport',
    summary: 'Consulte un lot et les appels qui ont suivi.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: LotExportDetailDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<LotExportDetailDto> {
    return this.lots.get(id);
  }
}
