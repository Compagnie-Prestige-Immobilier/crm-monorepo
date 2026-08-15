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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { Role } from '@crm/database';

import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ClientRequestsService } from './client-requests.service.js';
import {
  ApproveClientRequestDto,
  ClientRequestDto,
  ClientRequestListDto,
  ClientRequestQueryDto,
  CreateClientRequestDto,
  RejectClientRequestDto,
} from './dto.js';

/**
 * Demandes de création de client.
 *
 * DEUX PUBLICS, DEUX DROITS, et la frontière est portée par les décorateurs de
 * méthode : `RolesGuard` lit `getAllAndOverride([handler, class])`, donc un
 * décorateur de méthode REMPLACE celui de classe au lieu de s'y ajouter. C'est
 * pourquoi chaque route énumère ses rôles au complet.
 *
 * - BANQUE_FINANCE dépose et consulte SES demandes ;
 * - ADMIN voit tout et arbitre.
 *
 * Le cloisonnement de lecture est posé dans le service, pas ici : dans le
 * contrôleur, il dépendrait de la discipline de chaque route ajoutée ensuite.
 */
@ApiTags('client-requests')
@ApiBearerAuth()
@Roles(Role.ADMIN)
// Toute route de ce contrôleur peut refuser pour ces trois raisons : jeton
// absent ou expiré, rôle insuffisant, et entrée refusée par la validation
// globale (`forbidNonWhitelisted` transforme un paramètre mal orthographié en
// 400). Les déclarer ici évite de les oublier route par route, ce qui était le
// cas sur 116 opérations sur 119.
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'client-requests', version: '1' })
export class ClientRequestsController {
  constructor(private readonly requests: ClientRequestsService) {}

  @Post()
  @Roles(Role.BANQUE_FINANCE, Role.ADMIN)
  @ApiOperation({
    operationId: 'createClientRequest',
    summary: 'Demande la création d’un client absent de la base.',
    description:
      'Sortie de l’impasse « Aucun client ne correspond ». Le téléphone est normalisé en E.164 avant tout contrôle : un client déjà en base sous une autre présentation du même numéro est reconnu et la demande est refusée avec son numéro, plutôt que de créer un doublon.',
  })
  @ApiResponse({ status: 201, type: ClientRequestDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'CLIENT_REQUEST_PROSPECT_EXISTS · CLIENT_REQUEST_ALREADY_PENDING.',
  })
  @ApiResponse({ status: 422, type: ApiErrorDto, description: 'CLIENT_REQUEST_BANQUE_NOT_FOUND.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateClientRequestDto,
  ): Promise<ClientRequestDto> {
    return this.requests.create(user, body);
  }

  @Get()
  @Roles(Role.BANQUE_FINANCE, Role.ADMIN)
  @ApiOperation({
    operationId: 'listClientRequests',
    summary: 'Demandes de création, filtrables par statut.',
    description:
      'Un agent Banque & Finance ne voit que ses propres demandes : l’identité des clients qu’une autre banque cherche à faire créer ne le regarde pas.',
  })
  @ApiResponse({ status: 200, type: ClientRequestListDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ClientRequestQueryDto,
  ): Promise<ClientRequestListDto> {
    return this.requests.list(user, query);
  }

  @Get(':id')
  @Roles(Role.BANQUE_FINANCE, Role.ADMIN)
  @ApiOperation({ operationId: 'getClientRequest', summary: 'Détail d’une demande.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ClientRequestDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'CLIENT_REQUEST_NOT_FOUND.' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClientRequestDto> {
    return this.requests.get(user, id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'approveClientRequest',
    summary: 'Approuve la demande et crée le prospect, en une seule transaction.',
    description:
      'Le prospect naît en METHOD_OBTAINED avec sa provenance (origin=BANQUE, libellé = nom de la banque demandeuse) : c’est la condition exacte du filtre de recherche bancaire, donc le dossier peut lui être rattaché immédiatement.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ClientRequestDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'CLIENT_REQUEST_NOT_FOUND.' })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'CLIENT_REQUEST_ALREADY_REVIEWED · CLIENT_REQUEST_PROSPECT_EXISTS.',
  })
  @ApiResponse({
    status: 422,
    type: ApiErrorDto,
    description:
      'CLIENT_REQUEST_REPRESENTANT_NOT_FOUND · CLIENT_REQUEST_SYNDICAT_NOT_FOUND · CLIENT_REQUEST_BANQUE_NOT_FOUND.',
  })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApproveClientRequestDto,
  ): Promise<ClientRequestDto> {
    return this.requests.approve(user, id, body);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'rejectClientRequest',
    summary: 'Refuse la demande, motif obligatoire.',
    description:
      'Le motif remonte au demandeur par notification. Un refus muet le renverrait à l’impasse de départ.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ClientRequestDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'CLIENT_REQUEST_NOT_FOUND.' })
  @ApiResponse({ status: 409, type: ApiErrorDto, description: 'CLIENT_REQUEST_ALREADY_REVIEWED.' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectClientRequestDto,
  ): Promise<ClientRequestDto> {
    return this.requests.reject(user, id, body);
  }
}
