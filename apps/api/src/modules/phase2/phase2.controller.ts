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
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Role } from '@crm/database';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Phase2CampaignsService } from './campaigns.service.js';
import { Phase2DirectoryService } from './directory.service.js';
import { programmeFilename, writeProgrammePdf } from './programme-pdf.js';
import {
  CampaignDetailDto,
  CampaignListDto,
  CampaignQueryDto,
  CreateCampaignDto,
  DirectoryPageDto,
  DirectoryQueryDto,
} from './dto.js';

const PDF_MIME = 'application/pdf';

/**
 * Phase 2 — campagnes d'appels et annuaire.
 *
 * Deux publics, deux régimes d'autorisation :
 *
 * - les campagnes (création, suivi, clôture, programmes PDF) sont réservées à
 *   l'ADMIN. Elles montrent la répartition entre commerciaux, ce qui n'est ni
 *   utile ni sain à exposer aux intéressés ;
 * - l'annuaire est ouvert à tout COMMERCIAL, par construction : sa raison
 *   d'être est justement qu'un commercial puisse consulter un numéro qui ne lui
 *   a pas été attribué.
 *
 * Aucune route n'est ouverte à BANQUE_FINANCE : ce rôle travaille sur des
 * dossiers déjà constitués et n'a aucun besoin métier de la base d'appels.
 */
@ApiTags('phase2')
@ApiBearerAuth()
@Controller({ path: 'phase2', version: '1' })
export class Phase2Controller {
  constructor(
    private readonly campaigns: Phase2CampaignsService,
    private readonly directory: Phase2DirectoryService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Annuaire — déclaré AVANT les routes paramétrées, par lisibilité
  // ───────────────────────────────────────────────────────────────────────────

  @Get('directory')
  @Roles(Role.COMMERCIAL, Role.ADMIN)
  @ApiOperation({
    operationId: 'pullPhase2Directory',
    summary: 'Annuaire hors ligne : téléphone et état de phase 2, rien d’autre.',
    description:
      'Pagination keyset sur (updatedAt, id), page de 2 000 par défaut, retard de sécurité de 2 secondes. Chaque entrée porte exactement six champs : ni nom, ni banque, ni syndicat.',
  })
  @ApiResponse({ status: 200, type: DirectoryPageDto })
  @ApiResponse({ status: 400, description: 'PHASE2_DIRECTORY_CURSOR_INVALID.' })
  pullDirectory(@Query() query: DirectoryQueryDto): Promise<DirectoryPageDto> {
    return this.directory.pull(query);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Campagnes
  // ───────────────────────────────────────────────────────────────────────────

  @Get('campaigns')
  @Roles(Role.ADMIN)
  @ApiOperation({
    operationId: 'listCallCampaigns',
    summary: 'Liste des campagnes, avec l’avancement de chacune.',
  })
  @ApiResponse({ status: 200, type: CampaignListDto })
  listCampaigns(@Query() query: CampaignQueryDto): Promise<CampaignListDto> {
    return this.campaigns.list(query);
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
    status: 400,
    description:
      'PHASE2_COMMERCIAL_NOT_FOUND · PHASE2_NOT_A_COMMERCIAL · PHASE2_COMMERCIAL_INACTIVE.',
  })
  @ApiResponse({
    status: 409,
    description:
      'PHASE2_PROSPECT_ALREADY_ASSIGNED — une campagne concurrente a pris les mêmes prospects.',
  })
  @ApiResponse({ status: 422, description: 'PHASE2_NO_ELIGIBLE_PROSPECT.' })
  createCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCampaignDto,
  ): Promise<CampaignDetailDto> {
    return this.campaigns.create(user, body);
  }

  @Get('campaigns/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    operationId: 'getCallCampaign',
    summary: 'Détail d’une campagne, ventilé par commercial.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CampaignDetailDto })
  @ApiResponse({ status: 404, description: 'PHASE2_CAMPAIGN_NOT_FOUND.' })
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
  @ApiResponse({ status: 404, description: 'PHASE2_CAMPAIGN_NOT_FOUND.' })
  closeCampaign(@Param('id', ParseUUIDPipe) id: string): Promise<CampaignDetailDto> {
    return this.campaigns.close(id);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Programme PDF
  // ───────────────────────────────────────────────────────────────────────────

  @Get('campaigns/:id/commerciaux/:userId/programme.pdf')
  @Roles(Role.ADMIN)
  @ApiProduces(PDF_MIME)
  @ApiOperation({
    operationId: 'downloadCallProgrammePdf',
    summary: 'Programme d’appels imprimable d’un commercial.',
    description:
      'Ordre identique aux positions persistées. AUCUN nom de prospect n’y figure : chaque ligne se rapproche de sa fiche par son code court à six caractères.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Document PDF, en flux.',
    // Binaire déclaré explicitement : sans cela le générateur Dart fabrique une
    // méthode qui tente de désérialiser le PDF en JSON.
    content: { [PDF_MIME]: { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiResponse({ status: 404, description: 'PHASE2_CAMPAIGN_COMMERCIAL_NOT_FOUND.' })
  async downloadProgramme(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const programme = await this.campaigns.programme(id, userId);
    const generatedAt = new Date();

    // On écrit dans le flux Node brut : pdfkit pousse les pages au fil de
    // l'eau, et passer par la sérialisation de Fastify obligerait à tamponner
    // le document entier avant le premier octet.
    reply.hijack();
    reply.raw.setHeader('Content-Type', PDF_MIME);
    reply.raw.setHeader(
      'Content-Disposition',
      `attachment; filename="${programmeFilename({ generatedAt })}"`,
    );
    reply.raw.setHeader('Cache-Control', 'no-store');

    try {
      await writeProgrammePdf(reply.raw, { ...programme, generatedAt });
    } catch (error) {
      // Les en-têtes sont déjà partis : impossible de renvoyer un code
      // d'erreur. On coupe, ce que le client lit comme un téléchargement
      // incomplet — préférable à un PDF tronqué qui s'ouvrirait normalement.
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
