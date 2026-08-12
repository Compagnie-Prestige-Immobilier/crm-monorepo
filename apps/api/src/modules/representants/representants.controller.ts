import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { OkDto } from '../../common/dto/ok.dto.js';
import { RepresentantsService } from './representants.service.js';
import {
  CreateRepresentantDto,
  DeleteQueryDto,
  RepresentantDto,
  RepresentantListDto,
  RepresentantLookupDto,
  RepresentantLookupQueryDto,
  RepresentantQueryDto,
  UpdateRepresentantDto,
} from './dto.js';

@ApiTags('representants')
@ApiBearerAuth()
@Controller({ path: 'representants', version: '1' })
export class RepresentantsController {
  constructor(private readonly representants: RepresentantsService) {}

  @Get()
  @ApiOperation({
    operationId: 'listRepresentants',
    summary: 'Liste paginée. Un COMMERCIAL ne voit que ses propres représentants.',
  })
  @ApiResponse({ status: 200, type: RepresentantListDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RepresentantQueryDto,
  ): Promise<RepresentantListDto> {
    return this.representants.list(user, query);
  }

  /**
   * Déclaré AVANT `:id` : Fastify n'ordonne pas les routes par déclaration,
   * mais la lisibilité l'exige et cela protège d'une régression si l'adaptateur
   * change.
   */
  @Get('lookup')
  @ApiOperation({
    operationId: 'lookupRepresentantByPhone',
    summary: 'Cherche un représentant par téléphone, avant saisie.',
    description:
      'Répond même si la fiche appartient à un autre commercial, en nommant son propriétaire.',
  })
  @ApiResponse({ status: 200, type: RepresentantLookupDto })
  lookup(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RepresentantLookupQueryDto,
  ): Promise<RepresentantLookupDto> {
    return this.representants.lookup(user, query.phone);
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getRepresentant', summary: 'Détail d’un représentant.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: RepresentantDto })
  @ApiResponse({ status: 403, description: 'La fiche appartient à un autre commercial.' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RepresentantDto> {
    return this.representants.get(user, id);
  }

  @Post()
  @ApiOperation({
    operationId: 'createRepresentant',
    summary: 'Crée un représentant. L’identifiant peut être fourni par le client.',
  })
  @ApiResponse({ status: 201, type: RepresentantDto })
  @ApiResponse({ status: 409, description: 'Téléphone ou identifiant déjà pris.' })
  @ApiResponse({ status: 403, description: 'L’identifiant appartient à un autre commercial.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateRepresentantDto,
  ): Promise<RepresentantDto> {
    return this.representants.create(user, body);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateRepresentant', summary: 'Modifie un représentant.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: RepresentantDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRepresentantDto,
  ): Promise<RepresentantDto> {
    return this.representants.update(user, id, body);
  }

  @Delete(':id')
  @ApiOperation({
    operationId: 'deleteRepresentant',
    summary: 'Supprime logiquement un représentant.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: OkDto })
  @ApiResponse({ status: 409, description: 'Des prospects sont rattachés ; exige cascade=true.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteQueryDto,
  ): Promise<OkDto> {
    return this.representants.remove(user, id, query);
  }
}
