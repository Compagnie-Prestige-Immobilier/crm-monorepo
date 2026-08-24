import {
  Body,
  Controller,
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
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ImportKind, Role } from '@crm/database';
import type { FastifyRequest } from 'fastify';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { OkDto } from '../../common/dto/ok.dto.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ImportJobDto } from '../imports/dto.js';
import { ImportsService } from '../imports/imports.service.js';
import {
  SetVisiteImportChangeSelectionDto,
  VisiteImportChangeListDto,
  VisiteImportChangeQueryDto,
  VisitesRegistreRevueService,
} from '../imports/visites-registre.revue.service.js';

/**
 * L'aller-retour Excel du registre : dépôt, revue, application.
 *
 * `ImportsController` porte `@Roles(Role.ADMIN)` de classe et donnerait, en
 * plus, la liste de TOUS les imports, prospects compris. Ce contrôleur ouvre
 * exactement les cinq gestes du registre à ADMIN et DIRECTION — l'ACCUEIL
 * exporte et imprime, il ne corrige pas le registre en masse.
 *
 * Chaque route relit `job.kind` et répond 404 sur un travail d'une autre
 * nature : sans ce garde-fou, ces routes deviendraient un moyen d'appliquer
 * un import de prospects.
 */
@ApiTags('visites')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.DIRECTION)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'visites/import', version: '1' })
export class VisitesImportController {
  constructor(
    private readonly imports: ImportsService,
    private readonly revueService: VisitesRegistreRevueService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    operationId: 'createVisitesRegistreImport',
    summary: 'Dépose le classeur du registre exporté puis corrigé, et inscrit le travail.',
    description:
      'NE BLOQUE PAS : le classeur est écrit sur le volume, un travail `queued` est inscrit en ' +
      '`DRY_RUN`, et la réponse part. Le travail court en arrière-plan et détecte les ' +
      'différences ligne par ligne ; l’écran les lit par `GET /visites/import/{id}/revue`. ' +
      'Une ligne sans `N° REGISTRE` est une création ; un numéro renseigné et inconnu est refusé.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, type: ImportJobDto })
  @ApiErrors({
    413: 'IMPORT_FILE_TOO_LARGE · le classeur dépasse le plafond de taille.',
    429: true,
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<ImportJobDto> {
    return this.imports.create(user, request, ImportKind.VISITES_REGISTRE);
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'getVisitesRegistreImport',
    summary: 'État du travail, et son rapport quand il est terminé.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ImportJobDto })
  @ApiErrors({
    404: 'IMPORT_JOB_NOT_FOUND · ce travail n’existe pas, ou n’est pas un aller-retour du registre.',
  })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ImportJobDto> {
    await this.revueService.assertRegistreJob(id);
    return this.imports.get(id);
  }

  @Get(':id/revue')
  @ApiOperation({
    operationId: 'getVisitesRegistreImportRevue',
    summary: 'Les différences détectées, page par page.',
    description:
      'Une ligne par différence : `CREATE` pour une ligne sans numéro, `UPDATE` pour un numéro ' +
      'dont le contenu diverge. Les lignes identiques ne sont pas écrites, elles ne figurent pas ici.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: VisiteImportChangeListDto })
  @ApiErrors({
    404: 'IMPORT_JOB_NOT_FOUND · ce travail n’existe pas, ou n’est pas un aller-retour du registre.',
  })
  revue(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: VisiteImportChangeQueryDto,
  ): Promise<VisiteImportChangeListDto> {
    return this.revueService.revue(id, query);
  }

  @Patch(':id/revue')
  @ApiOperation({
    operationId: 'setVisitesRegistreImportSelection',
    summary: 'Coche ou décoche les lignes désignées.',
    description:
      'Coché par défaut à la détection : la directrice a exporté, corrigé et redéposé, son ' +
      'intention est d’appliquer. Cette route sert à RETIRER ce qu’elle ne veut pas.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: OkDto })
  @ApiErrors({
    404: 'IMPORT_JOB_NOT_FOUND · ce travail n’existe pas, ou n’est pas un aller-retour du registre.',
  })
  setSelection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetVisiteImportChangeSelectionDto,
  ): Promise<OkDto> {
    return this.revueService.setSelection(id, body);
  }

  @Post(':id/apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'applyVisitesRegistreImport',
    summary: 'Applique la revue : le même fichier est relu, et ce qui reste coché est écrit.',
    description:
      'Une correction faite au comptoir depuis la revue n’est jamais écrasée en silence : la ' +
      'ligne concernée est refusée et nommée dans le rapport, les autres s’appliquent quand même.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ImportJobDto })
  @ApiErrors({
    404: 'IMPORT_JOB_NOT_FOUND · ce travail n’existe pas, ou n’est pas un aller-retour du registre.',
    409: 'IMPORT_NOT_APPLICABLE · le travail n’est pas une simulation terminée, ou son échéance est passée.',
  })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  async apply(@Param('id', ParseUUIDPipe) id: string): Promise<ImportJobDto> {
    await this.revueService.assertRegistreJob(id);
    return this.imports.apply(id);
  }
}
