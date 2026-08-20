import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { Role } from '@crm/database';
import type { FastifyReply } from 'fastify';

import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ExportService } from './export.service.js';
import { ExportMode, ExportQueryDto } from './dto.js';
import { formatDakarDate } from './dakar.js';
import { DEMO_MODE_HEADER, demoFilenameSuffix, setDemoHeader } from './demo-marking.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { RepresentantsExportService } from './representants-export.service.js';
import { RepresentantExportQueryDto } from '../representants/dto.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Pas de `@Roles` de classe : les trois routes ne servent pas la meme population, une union
// de classe serait la regle la plus permissive et une route future en heriterait sans decision.
@ApiTags('export')
@ApiBearerAuth()
// 400 vient de `forbidNonWhitelisted` : un paramètre mal orthographié suffit à le déclencher.
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'export', version: '1' })
export class ExportController {
  constructor(
    private readonly exports: ExportService,
    private readonly representants: RepresentantsExportService,
    private readonly demo: DemoVisibilityService,
  ) {}

  // ADMIN et COMMERCIAL, les mêmes qu'`AnalyticsController` : la feuille Synthèse porte
  // exactement ses agrégats. Le cloisonnement par commercial reste dans `buildProspectWhere`.
  @Get('prospects.xlsx')
  @Roles(Role.ADMIN, Role.COMMERCIAL, Role.DIRECTION)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({
    operationId: 'exportProspectsXlsx',
    summary: 'Export Excel des prospects, avec le même filtre que la liste.',
    description:
      'Deux modes. `filtered` (défaut) : une feuille Prospects correspondant exactement aux filtres, plus Représentants et Synthèse. `consolidated` : exactement cinq feuilles, Consolidé, BDD1, BDD2, BDD3, BDD4.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Classeur Excel. En mode `filtered` : feuilles Prospects, Représentants et Synthèse. En mode `consolidated` : Consolidé, BDD1, BDD2, BDD3, BDD4.',
    headers: {
      [DEMO_MODE_HEADER]: {
        description:
          'Vrai si le classeur a été produit en mode démonstration, donc s’il mêle des lignes fictives à des lignes réelles.',
        schema: { type: 'string', enum: ['true', 'false'] },
      },
    },
    // Binaire explicite : sinon le générateur Dart désérialise le classeur en JSON.
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
    const demoEnabled = await this.demo.enabled();
    // Date de Dakar, et suffixe de démonstration : seule marque lisible sans ouvrir le fichier.
    const prefix = mode === ExportMode.CONSOLIDATED ? 'prospects-cpi-consolide' : 'prospects-cpi';
    const filename = `${prefix}-${formatDakarDate(new Date())}${demoFilenameSuffix(demoEnabled)}.xlsx`;

    // Flux Node brut : la sérialisation Fastify tamponnerait tout le classeur avant le 1er octet.
    reply.hijack();
    reply.raw.setHeader('Content-Type', XLSX_MIME);
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    reply.raw.setHeader('Cache-Control', 'no-store');
    setDemoHeader(reply.raw, demoEnabled);

    try {
      await this.exports.writeProspects(user, query, reply.raw, mode);
    } catch (error) {
      // En-têtes déjà partis : couper vaut mieux qu'un classeur tronqué qui s'ouvre quand même.
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /** ADMIN seul, comme `POST /v1/imports/prospects` qu'il sert. */
  @Get('prospects-modele.xlsx')
  @Roles(Role.ADMIN)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({
    operationId: 'downloadProspectsTemplateXlsx',
    summary: 'Modèle vide pour l’import de prospects.',
    description:
      'En-têtes figés, une ligne d’exemple grisée, un onglet Instructions, et des listes déroulantes alimentées depuis les référentiels VIVANTS. Banque et Syndicat sont des listes et non du texte libre : leur croisement détermine le segment BDD, et une valeur saisie à la main range la fiche dans le mauvais segment.',
  })
  @ApiResponse({
    status: 200,
    description: 'Classeur Excel à trois feuilles : Prospects, Instructions, Listes (masquée).',
    // Binaire explicite : sinon le générateur Dart désérialise le classeur en JSON.
    content: { [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } } },
  })
  async prospectsTemplate(@Res() reply: FastifyReply): Promise<void> {
    const filename = `modele-import-prospects-${formatDakarDate(new Date())}.xlsx`;

    reply.hijack();
    reply.raw.setHeader('Content-Type', XLSX_MIME);
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    reply.raw.setHeader('Cache-Control', 'no-store');

    try {
      await this.exports.writeProspectsImportTemplate(reply.raw);
    } catch (error) {
      // Les en-têtes sont partis : couper vaut mieux qu'un classeur tronqué.
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /** ADMIN seul, comme `POST /v1/imports/prospects-grand-public` qu'il sert. */
  @Get('prospects-grand-public-modele.xlsx')
  @Roles(Role.ADMIN)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({
    operationId: 'downloadProspectsGrandPublicTemplateXlsx',
    summary: 'Modèle vide pour l’import de prospects Grand Public.',
    description:
      'Syndicat, banque de domiciliation, fonctionnaire et canal de provenance sont des listes déroulantes, tirées des référentiels VIVANTS. Seuls le nom et le téléphone sont exigés : toute autre colonne peut rester vide, ou même manquer du fichier, car les colonnes sont retrouvées par le texte de leur en-tête et non par leur rang.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Classeur Excel à trois feuilles : Prospects Grand Public, Instructions, Listes (masquée).',
    // Binaire explicite : sinon le générateur Dart désérialise le classeur en JSON.
    content: { [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } } },
  })
  async prospectsGrandPublicTemplate(@Res() reply: FastifyReply): Promise<void> {
    const filename = `modele-import-prospects-grand-public-${formatDakarDate(new Date())}.xlsx`;

    reply.hijack();
    reply.raw.setHeader('Content-Type', XLSX_MIME);
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    reply.raw.setHeader('Cache-Control', 'no-store');

    try {
      await this.exports.writeProspectsGrandPublicImportTemplate(reply.raw);
    } catch (error) {
      // Les en-têtes sont partis : couper vaut mieux qu'un classeur tronqué.
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // ADMIN seul comme `POST /v1/representants/import` qu'il sert : un modèle que son
  // destinataire ne pourra pas déposer n'a pas à lui être proposé.
  @Get('representants-modele.xlsx')
  @Roles(Role.ADMIN)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({
    operationId: 'downloadRepresentantsTemplateXlsx',
    summary: 'Modèle vide pour l’import de représentants.',
    description:
      'En-têtes figés, une ligne d’exemple grisée, un onglet Instructions, et des listes déroulantes alimentées depuis les référentiels VIVANTS : un département désactivé ce matin ne figure pas dans le modèle téléchargé cet après-midi.',
  })
  @ApiResponse({
    status: 200,
    description: 'Classeur Excel à trois feuilles : Représentants, Instructions, Listes (masquée).',
    // Binaire explicite : sinon le générateur Dart désérialise le classeur en JSON.
    content: { [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } } },
  })
  async representantsTemplate(@Res() reply: FastifyReply): Promise<void> {
    const filename = `modele-import-representants-${formatDakarDate(new Date())}.xlsx`;

    reply.hijack();
    reply.raw.setHeader('Content-Type', XLSX_MIME);
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    reply.raw.setHeader('Cache-Control', 'no-store');

    try {
      await this.representants.writeTemplate(reply.raw);
    } catch (error) {
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Plus étroit que `GET /representants`, jamais plus large : un export plus large
  // que son écran serait un contournement. Le SUPERVISEUR consulte, il n'emporte pas
  // l'annuaire national dans un classeur.
  @Get('representants.xlsx')
  @Roles(Role.COMMERCIAL, Role.ADMIN, Role.DIRECTION)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({
    operationId: 'exportRepresentantsXlsx',
    summary: 'Export Excel des représentants, avec le même filtre que la liste.',
    description:
      'Mêmes critères que `GET /representants` : ce qui est exporté est exactement ce qui est affiché, cloisonnement par commercial compris.',
  })
  @ApiResponse({
    status: 200,
    description: 'Classeur Excel à une feuille.',
    headers: {
      [DEMO_MODE_HEADER]: {
        description:
          'Vrai si le classeur a été produit en mode démonstration, donc s’il mêle des lignes fictives à des lignes réelles.',
        schema: { type: 'string', enum: ['true', 'false'] },
      },
    },
    content: { [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } } },
  })
  async representantsExport(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RepresentantExportQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const demoEnabled = await this.demo.enabled();
    const filename = `representants-cpi-${formatDakarDate(new Date())}${demoFilenameSuffix(demoEnabled)}.xlsx`;

    reply.hijack();
    reply.raw.setHeader('Content-Type', XLSX_MIME);
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    reply.raw.setHeader('Cache-Control', 'no-store');
    setDemoHeader(reply.raw, demoEnabled);

    try {
      await this.representants.writeRepresentants(user, query, reply.raw);
    } catch (error) {
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
