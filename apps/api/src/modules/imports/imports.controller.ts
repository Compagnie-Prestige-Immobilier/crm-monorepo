import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ImportJobDto, ImportJobListDto, ImportJobQueryDto } from './dto.js';
import { ImportsService } from './imports.service.js';

/**
 * Les imports de masse, en arrière-plan. ADMIN uniquement.
 *
 * `@Roles(ADMIN)` est posé sur la CLASSE : une route ajoutée demain reste fermée
 * plutôt que d'être ouverte par oubli. Un import écrit des milliers de fiches
 * d'un coup ; c'est le geste le plus lourd de conséquences de tout le panel.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AUCUNE ROUTE NE PORTE `@DemoWritable`, ET C'EST LA DÉCISION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `DemoReadOnlyGuard` refuse tout POST tant que le mode démonstration est
 * allumé. Le dépôt d'un classeur en est un, donc il est refusé — et il doit
 * l'être : un import lancé pendant une démonstration mêlerait des milliers de
 * fiches réelles au jeu fictif affiché à l'écran.
 *
 * Le SUIVI reste un GET : il continue de répondre pendant une démonstration, ce
 * qui est correct. Un travail en cours a nécessairement été déposé alors que
 * l'interrupteur était éteint.
 *
 * LES MODÈLES DE CLASSEUR ne sont PAS servis ici : ils le sont par
 * `GET /export/representants-modele.xlsx` et `GET /export/prospects-modele.xlsx`,
 * dans le module d'export, qui est le seul endroit à savoir écrire un classeur.
 * Les dupliquer ferait exister deux modèles capables de diverger d'une colonne,
 * ce que `import-template.ts` et `prospects-import-template.ts` existent
 * précisément pour empêcher.
 */
@ApiTags('imports')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'imports', version: '1' })
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get()
  @ApiOperation({
    operationId: 'listImportJobs',
    summary: 'Liste paginée des travaux d’import, filtrable par entité et par état.',
  })
  @ApiResponse({ status: 200, type: ImportJobListDto })
  list(@Query() query: ImportJobQueryDto): Promise<ImportJobListDto> {
    return this.imports.list(query);
  }

  /**
   * Le plafond est bas, et il est second.
   *
   * Le vrai garde-fou est ailleurs : le fichier est borné en octets, le nombre
   * de lignes est borné par l'adaptateur, et le balayage ne démarre que trois
   * travaux par minute. Ce `@Throttle` empêche seulement qu'un script ne
   * transforme la route en robinet à fichiers sur le volume.
   */
  @Post('representants')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    operationId: 'createRepresentantsImport',
    summary: 'Dépose un classeur de représentants et inscrit le travail. Rend immédiatement.',
    description:
      'NE BLOQUE PAS : le classeur est écrit sur le volume, un travail `queued` est inscrit, ' +
      'et la réponse part. Le travail court en arrière-plan ; l’écran sonde ' +
      '`GET /imports/{id}`, dont `processedRows` sur `totalRows` donne l’avancement. ' +
      'Le travail naît TOUJOURS en `DRY_RUN` : rien n’est écrit tant que ' +
      '`POST /imports/{id}/apply` n’a pas été appelé. Le modèle de classeur se ' +
      'télécharge par `GET /export/representants-template.xlsx`.',
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
    409: 'DEMO_MODE_READ_ONLY · le mode démonstration est actif, aucun import ne peut être déposé.',
    413: 'IMPORT_FILE_TOO_LARGE · le classeur dépasse le plafond de taille.',
    429: true,
  })
  createRepresentants(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<ImportJobDto> {
    return this.imports.create(user, request, ImportKind.REPRESENTANTS);
  }

  /**
   * Une route par entité plutôt qu'un `{kind}` : `createRepresentantsImport` est
   * déjà engendré chez les deux clients, et les plafonds, modèles et
   * préconditions diffèrent d'une entité à l'autre.
   */
  @Post('prospects')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    operationId: 'createProspectsImport',
    summary: 'Dépose un classeur de prospects et inscrit le travail. Rend immédiatement.',
    description:
      'NE BLOQUE PAS : le classeur est écrit sur le volume, un travail `queued` est inscrit, ' +
      'et la réponse part. Le travail court en arrière-plan ; l’écran sonde ' +
      '`GET /imports/{id}`, dont `processedRows` sur `totalRows` donne l’avancement. ' +
      'Le travail naît TOUJOURS en `DRY_RUN` : rien n’est écrit tant que ' +
      '`POST /imports/{id}/apply` n’a pas été appelé. Le modèle de classeur se ' +
      'télécharge par `GET /export/prospects-modele.xlsx`, dont les colonnes Banque et ' +
      'Syndicat sont des listes déroulantes tirées des référentiels vivants. ' +
      'CET IMPORT NE CRÉE AUCUN REPRÉSENTANT : chaque ligne doit désigner, par son ' +
      'numéro, un représentant déjà en base.',
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
    409: 'DEMO_MODE_READ_ONLY · le mode démonstration est actif, aucun import ne peut être déposé.',
    413: 'IMPORT_FILE_TOO_LARGE · le classeur dépasse le plafond de taille.',
    429: true,
  })
  createProspects(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<ImportJobDto> {
    return this.imports.create(user, request, ImportKind.PROSPECTS);
  }

  /**
   * Aucun modèle à télécharger : ce classeur EXISTE, tenu à l'accueil depuis des
   * années. C'est l'import qui s'adapte à sa forme, pas l'inverse.
   */
  @Post('visites')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    operationId: 'createVisitesImport',
    summary:
      'Dépose le classeur des visites de l’accueil et inscrit le travail. Rend immédiatement.',
    description:
      'NE BLOQUE PAS : le classeur est écrit sur le volume, un travail `queued` est inscrit, ' +
      'et la réponse part. Le travail naît TOUJOURS en `DRY_RUN` : rien n’est écrit tant que ' +
      '`POST /imports/{id}/apply` n’a pas été appelé. Seuls les onglets « BDD VISITES » sont lus, ' +
      'en-tête en ligne 3, données à partir de la colonne C. La colonne « N° » n’est pas reprise : ' +
      'elle repart à 1 chaque mois. CET IMPORT NE CRÉE AUCUNE ENTRÉE DE RÉFÉRENTIEL : une ' +
      'entreprise, une direction, un destinataire ou un objet absent des quatre listes fait ' +
      'refuser la ligne, avec sa valeur exacte, son onglet et son numéro de ligne au rapport.',
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
    409: 'DEMO_MODE_READ_ONLY · le mode démonstration est actif, aucun import ne peut être déposé.',
    413: 'IMPORT_FILE_TOO_LARGE · le classeur dépasse le plafond de taille.',
    429: true,
  })
  createVisites(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<ImportJobDto> {
    return this.imports.create(user, request, ImportKind.VISITES);
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'getImportJob',
    summary: 'État d’un travail d’import, et son rapport quand il est terminé.',
    description:
      'Route de SONDAGE. `processedRows` avance à chaque tranche écrite, sans qu’aucun ' +
      'mécanisme de progression n’ait eu à être inventé : c’est le compteur que la ' +
      'transaction de la tranche avance elle-même.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ImportJobDto })
  @ApiErrors({ 404: 'IMPORT_JOB_NOT_FOUND · ce travail d’import n’existe pas.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ImportJobDto> {
    return this.imports.get(id);
  }

  @Post(':id/apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'applyImportJob',
    summary: 'Applique une simulation terminée : le même fichier est réécrit en base.',
    description:
      'Remet le MÊME travail en file, en mode `APPLY`. Les compteurs et le rapport de la ' +
      'simulation sont remplacés par ceux de l’application. Refusé si le travail n’est pas ' +
      'une simulation terminée, ou si son échéance est passée — le classeur a alors été détruit.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ImportJobDto })
  @ApiErrors({
    404: 'IMPORT_JOB_NOT_FOUND · ce travail d’import n’existe pas.',
    409:
      'IMPORT_NOT_APPLICABLE · le travail n’est pas une simulation terminée, ou son échéance ' +
      'est passée. DEMO_MODE_READ_ONLY · le mode démonstration est actif.',
  })
  apply(@Param('id', ParseUUIDPipe) id: string): Promise<ImportJobDto> {
    return this.imports.apply(id);
  }
}
