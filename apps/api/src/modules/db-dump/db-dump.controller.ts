import { Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
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
import { DbDumpService } from './db-dump.service.js';
import { DatabaseDumpJobDto } from './dto.js';

/**
 * Export intégral de la base : demande, état, téléchargement.
 *
 * `@Roles(ADMIN)` est posé sur la CLASSE : une route ajoutée sans décorateur
 * reste fermée plutôt que d'être ouverte par oubli.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AUCUNE ROUTE NE PORTE `@DemoWritable`, ET C'EST LA DÉCISION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `DemoReadOnlyGuard` refuse tout POST tant que le mode démonstration est
 * allumé. La demande d'export en est un, donc elle est refusée : c'est
 * exactement ce qu'il faut. Un export pris pendant une démonstration
 * emporterait les milliers de lignes fictives que le semeur vient d'écrire,
 * dans un fichier qui a par ailleurs toutes les apparences d'un export de
 * production, et que personne ne pourrait plus distinguer six mois plus tard.
 *
 * Une dispense aurait été le réflexe (« ce n'est qu'une lecture »). Elle serait
 * fausse : la demande ÉCRIT, elle inscrit un travail, et surtout ce qu'elle
 * produit est précisément ce que le mode démonstration existe pour empêcher de
 * confondre.
 *
 * Le TÉLÉCHARGEMENT est un GET : il reste possible pendant une démonstration,
 * et c'est correct. Un fichier prêt a nécessairement été produit alors que
 * l'interrupteur était éteint.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'admin/database-dump', version: '1' })
export class DbDumpController {
  constructor(private readonly dumps: DbDumpService) {}

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
  state(): Promise<DatabaseDumpJobDto> {
    return this.dumps.state();
  }

  /**
   * Le plafond est bas, et il est second.
   *
   * Le vrai garde-fou est l'unicité : un export déjà en cours est RENDU, il
   * n'en démarre pas un second. Ce `@Throttle` ne sert qu'à empêcher qu'un
   * script transforme la route en robinet à lignes d'audit et à travaux
   * relancés dès que le précédent expire.
   */
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
      'pendant une démonstration, un export y mêlerait des lignes fictives aux ' +
      'vraies. Le fichier est détruit dès son téléchargement, et de toute façon à ' +
      'son échéance.',
  })
  @ApiResponse({ status: 202, type: DatabaseDumpJobDto })
  @ApiErrors({
    409:
      'DEMO_MODE_READ_ONLY · le mode démonstration est actif. ' +
      'DATABASE_DUMP_IN_PROGRESS · un export démarre à l’instant même.',
    429: true,
  })
  request(@CurrentUser() user: AuthenticatedUser): Promise<DatabaseDumpJobDto> {
    return this.dumps.request(user);
  }

  /**
   * AUCUN paramètre, et c'est la propriété de sécurité de cette route.
   *
   * Le fichier servi est celui que la base nomme. Rien de la requête n'entre
   * dans un chemin. Une route qui prendrait un identifiant, même « validé »,
   * serait un chemin dérivé d'une entrée utilisateur devant l'export intégral
   * de la clientèle.
   */
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
    return this.dumps.download(user, reply);
  }
}
