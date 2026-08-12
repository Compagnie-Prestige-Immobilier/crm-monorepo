import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ExportService } from './export.service.js';
import { ExportMode, ExportQueryDto } from './dto.js';
import { formatDakarDate } from './dakar.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('export')
@ApiBearerAuth()
@Controller({ path: 'export', version: '1' })
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get('prospects.xlsx')
  @ApiOperation({
    operationId: 'exportProspectsXlsx',
    summary: 'Export Excel des prospects, avec le même filtre que la liste.',
    description:
      'Deux modes. `filtered` (défaut) : une feuille Prospects correspondant exactement aux filtres, plus Représentants et Synthèse. `consolidated` : exactement cinq feuilles — Consolidé, BDD1, BDD2, BDD3, BDD4.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Classeur Excel. En mode `filtered` : feuilles Prospects, Représentants et Synthèse. En mode `consolidated` : Consolidé, BDD1, BDD2, BDD3, BDD4.',
    // Déclaré en binaire explicite : sans cela, le générateur Dart produit une
    // méthode qui tente de désérialiser le classeur en JSON.
    content: {
      [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } },
    },
  })
  async prospects(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExportQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const mode = query.mode ?? ExportMode.FILTERED;
    // Le nom de fichier porte la date de Dakar : un export lancé en soirée ne
    // doit pas s'appeler du lendemain parce que le serveur tourne en UTC+2.
    const prefix = mode === ExportMode.CONSOLIDATED ? 'prospects-cpi-consolide' : 'prospects-cpi';
    const filename = `${prefix}-${formatDakarDate(new Date())}.xlsx`;

    // On écrit dans le flux Node brut : exceljs pousse le XML au fil de l'eau,
    // et passer par la sérialisation de Fastify obligerait à tamponner tout le
    // classeur avant le premier octet.
    reply.hijack();
    reply.raw.setHeader('Content-Type', XLSX_MIME);
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    reply.raw.setHeader('Cache-Control', 'no-store');

    try {
      await this.exports.writeProspects(user, query, reply.raw, mode);
    } catch (error) {
      // Les en-têtes sont déjà partis : impossible de renvoyer un code
      // d'erreur. On coupe la connexion, ce que le client interprète comme un
      // téléchargement incomplet — bien préférable à un fichier tronqué qui
      // s'ouvrirait comme s'il était complet.
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
