import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { Role } from '@crm/database';
import type { FastifyReply } from 'fastify';

import { Roles } from '../../common/decorators/roles.decorator.js';
// Fonction pure et testée du module export. La réimplémenter ici ferait exister
// deux définitions de « la date à Dakar », qui finiraient par diverger d'un
// fichier à l'autre.
import { formatDakarDate } from '../export/dakar.js';
import { DEMO_MODE_HEADER, demoFilenameSuffix, setDemoHeader } from '../export/demo-marking.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { BankCasesExportService } from './bank-cases-export.service.js';
import { BankCaseFilterDto } from './dto.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Export Excel des dossiers bancaires.
 *
 * Le chemin `export` est partagé avec `ExportController` : Nest autorise deux
 * contrôleurs sur un même préfixe tant que les routes diffèrent, et garder cet
 * export ici plutôt que dans le module `export` évite qu'un module tiers ait à
 * dépendre des services de Banque & Finance.
 */
@ApiTags('export')
@ApiBearerAuth()
@Roles(Role.BANQUE_FINANCE, Role.ADMIN)
// Toute route de ce contrôleur peut refuser pour ces trois raisons : jeton
// absent ou expiré, rôle insuffisant, et entrée refusée par la validation
// globale (`forbidNonWhitelisted` transforme un paramètre mal orthographié en
// 400). Les déclarer ici évite de les oublier route par route, ce qui était le
// cas sur 116 opérations sur 119.
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
    // Binaire explicite : sans ce contenu, le générateur Dart produit une
    // méthode qui tente de désérialiser le classeur en JSON.
    content: {
      [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } },
    },
  })
  async bankCases(@Query() query: BankCaseFilterDto, @Res() reply: FastifyReply): Promise<void> {
    const demoEnabled = await this.demo.enabled();
    const filename = `dossiers-bancaires-${formatDakarDate(new Date())}${demoFilenameSuffix(demoEnabled)}.xlsx`;

    // Écriture dans le flux Node brut : exceljs pousse le XML au fil de l'eau,
    // et passer par la sérialisation de Fastify obligerait à tamponner tout le
    // classeur avant le premier octet.
    reply.hijack();
    reply.raw.setHeader('Content-Type', XLSX_MIME);
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    reply.raw.setHeader('Cache-Control', 'no-store');
    setDemoHeader(reply.raw, demoEnabled);

    try {
      await this.exports.write(query, reply.raw);
    } catch (error) {
      // Les en-têtes sont partis : impossible de renvoyer un code d'erreur. On
      // coupe la connexion, ce que le client lit comme un téléchargement
      // incomplet, préférable à un fichier tronqué qui s'ouvrirait comme s'il
      // était entier.
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
