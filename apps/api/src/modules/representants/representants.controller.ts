import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { Role } from '@crm/database';
import type { FastifyRequest } from 'fastify';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { OkDto } from '../../common/dto/ok.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RepresentantsService } from './representants.service.js';
import { RepresentantsImportService } from './representants-import.service.js';
import {
  CreateRepresentantCommentDto,
  CreateRepresentantDto,
  DeleteQueryDto,
  ImportQueryDto,
  ImportReportDto,
  RepresentantCommentDto,
  RepresentantCommentListDto,
  RepresentantCommentQueryDto,
  RepresentantDto,
  RepresentantListDto,
  RepresentantLookupDto,
  RepresentantLookupQueryDto,
  RepresentantQueryDto,
  RepresentantRelationChangeListDto,
  UpdateRepresentantDto,
} from './dto.js';

@ApiTags('representants')
@ApiBearerAuth()
@Roles(Role.COMMERCIAL, Role.ADMIN)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'representants', version: '1' })
export class RepresentantsController {
  constructor(
    private readonly representants: RepresentantsService,
    private readonly imports: RepresentantsImportService,
  ) {}

  @Get()
  @Roles(Role.COMMERCIAL, Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
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

  @Post('import')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    operationId: 'importRepresentants',
    summary: 'Import de masse depuis un classeur Excel, en deux temps.',
    description:
      '`dryRun=true` (défaut) SIMULE : rien n’est écrit, et le rapport liste les erreurs avec leur numéro de ligne dans le fichier, ainsi que les doublons de téléphone (dans le fichier et contre la base). `dryRun=false` applique, en une seule transaction : tout ou rien. Le premier temps n’est pas une précaution décorative, c’est ce qui évite d’écrire quelques milliers de fiches dont personne ne sait lesquelles sont bonnes.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 200, type: ImportReportDto })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description:
      'REPRESENTANT_IMPORT_FILE_MISSING · REPRESENTANT_IMPORT_FILE_UNREADABLE · REPRESENTANT_IMPORT_SHEET_MISSING · REPRESENTANT_IMPORT_TOO_MANY_ROWS.',
  })
  @ApiResponse({
    status: 413,
    type: ApiErrorDto,
    description: 'REPRESENTANT_IMPORT_FILE_TOO_LARGE.',
  })
  import(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
    @Query() query: ImportQueryDto,
  ): Promise<ImportReportDto> {
    return this.imports.import(user, request, query);
  }

  @Get(':id')
  @Roles(Role.COMMERCIAL, Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({ operationId: 'getRepresentant', summary: 'Détail d’un représentant.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: RepresentantDto })
  @ApiResponse({
    status: 403,
    type: ApiErrorDto,
    description: 'La fiche appartient à un autre commercial.',
  })
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
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'Téléphone ou identifiant déjà pris.',
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorDto,
    description: 'L’identifiant appartient à un autre commercial.',
  })
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

  @Get(':id/relation-history')
  @Roles(Role.COMMERCIAL, Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({
    operationId: 'listRepresentantRelationChanges',
    summary:
      'Bascules de relation déjà subies par une fiche, de la plus récente à la plus ancienne.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: RepresentantRelationChangeListDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorDto,
    description: 'REPRESENTANT_NOT_FOUND.',
  })
  relationHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RepresentantRelationChangeListDto> {
    return this.representants.relationHistory(user, id);
  }

  @Get(':id/comments')
  @Roles(Role.COMMERCIAL, Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({
    operationId: 'listRepresentantComments',
    summary: 'Fil de commentaires d’une fiche, du plus récent au plus ancien.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: RepresentantCommentListDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'REPRESENTANT_NOT_FOUND.' })
  listComments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: RepresentantCommentQueryDto,
  ): Promise<RepresentantCommentListDto> {
    return this.representants.listComments(user, id, query);
  }

  @Post(':id/comments')
  @ApiOperation({
    operationId: 'addRepresentantComment',
    summary: 'Ajoute un commentaire. L’identifiant fourni sert de clé d’idempotence.',
    description:
      'Le fil est en AJOUT SEUL : ni édition ni fusion, deux téléconseillers hors ligne produisent deux lignes. Reposter le même identifiant rend la ligne déjà enregistrée.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: RepresentantCommentDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'REPRESENTANT_NOT_FOUND.' })
  @ApiResponse({
    status: 403,
    type: ApiErrorDto,
    description: 'ENTITY_ID_OWNED_BY_ANOTHER_USER · NOT_OWNER.',
  })
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateRepresentantCommentDto,
  ): Promise<RepresentantCommentDto> {
    return this.representants.addComment(user, id, body);
  }

  @Delete(':id/comments/:commentId')
  @Roles(Role.ADMIN)
  @ApiOperation({
    operationId: 'deleteRepresentantComment',
    summary: 'Supprime logiquement un commentaire.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'commentId', format: 'uuid' })
  @ApiResponse({ status: 200, type: OkDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorDto,
    description: 'REPRESENTANT_COMMENT_NOT_FOUND.',
  })
  removeComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<OkDto> {
    return this.representants.removeComment(id, commentId);
  }

  @Delete(':id')
  @ApiOperation({
    operationId: 'deleteRepresentant',
    summary: 'Supprime logiquement un représentant.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: OkDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'Des prospects sont rattachés ; exige cascade=true.',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteQueryDto,
  ): Promise<OkDto> {
    return this.representants.remove(user, id, query);
  }
}
