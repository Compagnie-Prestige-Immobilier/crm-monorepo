import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@crm/database';
import type { FastifyReply } from 'fastify';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { DEMO_MODE_HEADER, setDemoHeader } from '../export/demo-marking.js';
import { WorkspaceContext } from '../../workspaces/workspace.js';
import { CreateLotExportDto, LotExportDetailDto, LotExportListDto, LotExportPreviewDto, LotExportQueryDto, LotExportSummaryDto } from './dto.js';
import { LotsExportService } from './lots-export.service.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('lots-export') @ApiBearerAuth() @ApiErrors({ 400: true, 401: true, 403: true }) @Controller({ path: 'lots-export', version: '1' })
export class LotsExportController {
  constructor(private readonly lots: LotsExportService, private readonly workspace: WorkspaceContext) {}
  @Post() @Roles(Role.ADMIN) @ApiOperation({ operationId: 'createLotExport', summary: 'Crée un lot de fiches exportées.' }) @ApiResponse({ status: 201, type: LotExportSummaryDto }) create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLotExportDto): Promise<LotExportSummaryDto> { return this.lots.create(user, body); }
  @Get('apercu') @Roles(Role.ADMIN) @ApiOperation({ operationId: 'previewLotExport', summary: 'Compte les fiches d’une cible.' }) @ApiResponse({ status: 200, type: LotExportPreviewDto }) preview(@Query() query: CreateLotExportDto): Promise<LotExportPreviewDto> { return this.lots.preview(query); }
  @Get() @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION) @ApiOperation({ operationId: 'listLotsExport', summary: 'Liste les lots d’export.' }) @ApiResponse({ status: 200, type: LotExportListDto }) list(@Query() query: LotExportQueryDto): Promise<LotExportListDto> { return this.lots.list(query); }
  @Get(':id/export.xlsx') @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION) @ApiProduces(XLSX_MIME) @ApiOperation({ operationId: 'downloadLotExportXlsx', summary: 'Télécharge le classeur figé du lot.' }) @ApiParam({ name: 'id', format: 'uuid' }) @ApiResponse({ status: 200, content: { [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } } } }) async xlsx(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply): Promise<void> { reply.hijack(); reply.raw.setHeader('Content-Type', XLSX_MIME); reply.raw.setHeader('Content-Disposition', `attachment; filename="lot-${id}.xlsx"`); reply.raw.setHeader('Cache-Control', 'no-store'); setDemoHeader(reply.raw, this.workspace.current() === 'demo'); await this.lots.writeXlsx(id, user, reply.raw); }
  @Get(':id') @Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION) @ApiOperation({ operationId: 'getLotExport', summary: 'Consulte un lot et les appels qui ont suivi.' }) @ApiParam({ name: 'id', format: 'uuid' }) @ApiResponse({ status: 200, type: LotExportDetailDto }) get(@Param('id', ParseUUIDPipe) id: string): Promise<LotExportDetailDto> { return this.lots.get(id); }
}
