import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { Role } from '@crm/database';
import type { FastifyReply } from 'fastify';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { formatDakarDate } from '../export/dakar.js';
import { DEMO_MODE_HEADER, demoFilenameSuffix, setDemoHeader } from '../export/demo-marking.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { BankCasesExportService } from './bank-cases-export.service.js';
import { BankCaseFilterDto } from './dto.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('export')
@ApiBearerAuth()
@Roles(Role.BANQUE_FINANCE, Role.ADMIN)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'export', version: '1' })
export class BankCasesExportController {
  constructor(
    private readonly exports: BankCasesExportService,
    private readonly demo: DemoVisibilityService,
  ) {}

  @Get('bank-cases.xlsx')
  @ApiOperation({
    operationId: 'exportBankCasesXlsx',
    summary: 'Export Excel des dossiers bancaires, avec le filtre de la liste.',
    description:
      'Trois feuilles : Dossiers (une ligne par dossier filtré), Historique (toutes les transitions de ces dossiers) et Synthèse (les mêmes agrégats que le tableau de bord).',
  })
  @ApiResponse({
    status: 200,
    description: 'Classeur Excel à trois feuilles : Dossiers, Historique, Synthèse.',
    headers: {
      [DEMO_MODE_HEADER]: {
        description:
          'Vrai si le classeur a été produit en mode démonstration, donc s’il mêle des lignes fictives à des lignes réelles.',
        schema: { type: 'string', enum: ['true', 'false'] },
      },
    },
    content: {
      [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } },
    },
  })
  async bankCases(@Query() query: BankCaseFilterDto, @Res() reply: FastifyReply): Promise<void> {
    const demoEnabled = await this.demo.enabled();
    const filename = `dossiers-bancaires-${formatDakarDate(new Date())}${demoFilenameSuffix(demoEnabled)}.xlsx`;

    reply.hijack();
    reply.raw.setHeader('Content-Type', XLSX_MIME);
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    reply.raw.setHeader('Cache-Control', 'no-store');
    setDemoHeader(reply.raw, demoEnabled);

    try {
      await this.exports.write(query, reply.raw, demoEnabled);
    } catch (error) {
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
