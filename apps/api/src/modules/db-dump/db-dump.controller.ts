import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Role } from '@crm/database';
import type { FastifyReply } from 'fastify';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { DbDumpEnabledGuard } from './db-dump-enabled.guard.js';
import { DbDumpService } from './db-dump.service.js';
import { DatabaseDumpJobDto } from './dto.js';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@UseGuards(DbDumpEnabledGuard)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'admin/database-dump', version: '1' })
export class DbDumpController {
  constructor(private readonly dumps: DbDumpService) {}

  private assertPublicWorkspace(user: AuthenticatedUser): void {
    if (user.workspace === 'demo') {
      throw new ForbiddenException({
        code: 'DEMO_WORKSPACE_EXTERNAL_OPERATION_FORBIDDEN',
        message: 'Quittez l’espace démo pour exporter la base.',
      });
    }
  }

  @Get()
  @ApiOperation({
    operationId: 'getDatabaseDump',
    summary: 'État de l’export intégral en cours ou du dernier produit.',
    description:
      'Route de SONDAGE : l’écran des paramètres l’interroge pendant que l’export ' +
      'court. Elle réconcilie aussi l’état avec l’horloge : un fichier échu est ' +
      'détruit ici, et un export interrompu par un redémarrage passe en `failed` ' +
      'plutôt que de bloquer indéfiniment toute nouvelle demande.',
  })
  @ApiResponse({ status: 200, type: DatabaseDumpJobDto })
  state(@CurrentUser() user: AuthenticatedUser): Promise<DatabaseDumpJobDto> {
    this.assertPublicWorkspace(user);
    return this.dumps.state();
  }

  @Post()
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    operationId: 'requestDatabaseDump',
    summary: 'Demande un export intégral de la base (schéma et données).',
    description:
      'Rend IMMÉDIATEMENT, avec un identifiant et un état ; `pg_dump` tourne en ' +
      'arrière-plan. Un avis part ensuite dans la boîte de réception et par ' +
      'e-mail, SANS aucun lien : le fichier ne se télécharge que dans une session ' +
      'authentifiée, par `GET admin/database-dump/download`. Un export déjà en ' +
      'cours est renvoyé tel quel, aucun second `pg_dump` n’est lancé. Refusé ' +
      'dans l’espace démo. Le fichier est détruit dès son téléchargement, et de toute façon à ' +
      'son échéance.',
  })
  @ApiResponse({ status: 202, type: DatabaseDumpJobDto })
  @ApiErrors({
    409: 'DATABASE_DUMP_IN_PROGRESS · un export démarre à l’instant même.',
    429: true,
  })
  request(@CurrentUser() user: AuthenticatedUser): Promise<DatabaseDumpJobDto> {
    this.assertPublicWorkspace(user);
    return this.dumps.request(user);
  }

  @Get('download')
  @ApiOperation({
    operationId: 'downloadDatabaseDump',
    summary: 'Télécharge l’export prêt, puis le détruit.',
    description:
      'Ne prend aucun paramètre : le fichier servi est celui de l’export courant. ' +
      'Le téléchargement est journalisé au nom de l’administrateur, et le fichier ' +
      'est détruit une fois la réponse entièrement émise. Un téléchargement ' +
      'interrompu ne détruit rien, il peut être repris.',
  })
  @ApiProduces('application/gzip')
  @ApiResponse({
    status: 200,
    content: { 'application/gzip': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiResponse({
    status: 404,
    description: 'DATABASE_DUMP_NOT_READY · aucun export disponible, échu, ou déjà téléchargé.',
    content: { 'application/json': { schema: { $ref: getSchemaPath(ApiErrorDto) } } },
  })
  download(@CurrentUser() user: AuthenticatedUser, @Res() reply: FastifyReply): Promise<void> {
    this.assertPublicWorkspace(user);
    return this.dumps.download(user, reply);
  }
}
