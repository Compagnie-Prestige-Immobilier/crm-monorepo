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

@ApiTags('client-requests')
@ApiBearerAuth()
// `RolesGuard` lit `getAllAndOverride([handler, class])` : un `@Roles` de méthode REMPLACE celui
// de la classe au lieu de s'y ajouter, d'où l'énumération complète des rôles sur chaque route.
@Roles(Role.ADMIN)
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
      'Le prospect naît avec sa provenance (origin=BANQUE, libellé = nom de la banque demandeuse), puis sa qualification CHUES continue côté panel.',
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
