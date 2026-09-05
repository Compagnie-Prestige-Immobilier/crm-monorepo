import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Projet, Role } from '@crm/database';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { EnrolementService } from './enrolement.service.js';
import { EnrolementIndicateursService } from './indicateurs.service.js';
import {
  EnrolementIndicateursDto,
  EnrolementReglagesDto,
  InscriptionPlateformeDetailDto,
  InscriptionsPageDto,
  InscriptionsQueryDto,
  SuppressionDto,
  TirageDto,
  UpdateEnrolementReglagesDto,
} from './dto.js';

/**
 * Le connecteur des plateformes d'enrôlement, réservé à la cellule pilotage et
 * performance, qui tient le rôle ADMIN.
 *
 * `@Roles(Role.ADMIN)` est posé sur la CLASSE : aucune route de ce contrôleur
 * ne s'ouvre par oubli, y compris une route ajoutée plus tard. Rien de ce qui
 * vient d'une plateforme n'est lisible ailleurs dans l'application.
 *
 * Le projet est un segment de chemin et non un filtre facultatif : une
 * inscription CHUES et une inscription Grand Public ne se rencontrent nulle
 * part, et une route sans projet aurait fini par les mélanger.
 */
@ApiTags('enrolement')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@ApiErrors({ 400: true, 401: true, 403: true, 404: true })
@ApiParam({ name: 'projet', enum: Projet, enumName: 'Projet' })
@Controller({ path: 'enrolement/:projet', version: '1' })
export class EnrolementController {
  constructor(
    private readonly enrolement: EnrolementService,
    private readonly indicateurs: EnrolementIndicateursService,
  ) {}

  @Get('inscriptions')
  @ApiOperation({
    operationId: 'listEnrolementInscriptions',
    summary: 'Les inscriptions lues sur la plateforme du projet.',
  })
  @ApiResponse({ status: 200, type: InscriptionsPageDto })
  list(
    @Param('projet', new ParseEnumPipe(Projet)) projet: Projet,
    @Query() query: InscriptionsQueryDto,
  ): Promise<InscriptionsPageDto> {
    return this.enrolement.lister(projet, query);
  }

  @Get('inscriptions/:id')
  @ApiOperation({
    operationId: 'getEnrolementInscription',
    summary: 'Une inscription, charge utile brute comprise.',
  })
  @ApiResponse({ status: 200, type: InscriptionPlateformeDetailDto })
  get(
    @Param('projet', new ParseEnumPipe(Projet)) projet: Projet,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InscriptionPlateformeDetailDto> {
    return this.enrolement.detail(projet, id);
  }

  @Get('indicateurs')
  @ApiOperation({
    operationId: 'getEnrolementIndicateurs',
    summary: 'Les indicateurs d’enrôlement du projet.',
  })
  @ApiResponse({ status: 200, type: EnrolementIndicateursDto })
  indicateursDuProjet(
    @Param('projet', new ParseEnumPipe(Projet)) projet: Projet,
    @Query() query: InscriptionsQueryDto,
  ): Promise<EnrolementIndicateursDto> {
    return this.indicateurs.indicateurs(projet, {
      ...(query.dateFrom === undefined ? {} : { dateFrom: query.dateFrom }),
      ...(query.dateTo === undefined ? {} : { dateTo: query.dateTo }),
    });
  }

  @Get('reglages')
  @ApiOperation({
    operationId: 'getEnrolementReglages',
    summary: 'Fréquence, date de reprise et compte rendu du dernier tirage.',
  })
  @ApiResponse({ status: 200, type: EnrolementReglagesDto })
  reglages(
    @Param('projet', new ParseEnumPipe(Projet)) projet: Projet,
  ): Promise<EnrolementReglagesDto> {
    return this.enrolement.reglages(projet);
  }

  @Put('reglages')
  @ApiOperation({
    operationId: 'putEnrolementReglages',
    summary: 'Change la fréquence de tirage ou la date de reprise.',
  })
  @ApiResponse({ status: 200, type: EnrolementReglagesDto })
  majReglages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projet', new ParseEnumPipe(Projet)) projet: Projet,
    @Body() body: UpdateEnrolementReglagesDto,
  ): Promise<EnrolementReglagesDto> {
    return this.enrolement.majReglages(projet, user.id, body);
  }

  @Post('tirage')
  @ApiOperation({
    operationId: 'postEnrolementTirage',
    summary: 'Tire la plateforme maintenant, sans attendre l’échéance.',
    description:
      'Le tirage est idempotent : une inscription déjà lue est mise à jour, jamais redéposée.',
  })
  @ApiResponse({ status: 201, type: TirageDto })
  tirer(@Param('projet', new ParseEnumPipe(Projet)) projet: Projet): Promise<TirageDto> {
    return this.enrolement.tirer(projet);
  }

  @Delete('inscriptions')
  @ApiOperation({
    operationId: 'purgeEnrolementInscriptions',
    summary: 'Vide le miroir du projet.',
    description:
      'Rien n’est touché sur la plateforme : le tirage suivant relit tout. Vider puis tirer sert à vérifier la conformité de ce que montre le CRM.',
  })
  @ApiResponse({ status: 200, type: SuppressionDto })
  async purger(
    @Param('projet', new ParseEnumPipe(Projet)) projet: Projet,
  ): Promise<SuppressionDto> {
    return { supprimees: await this.enrolement.purger(projet) };
  }

  @Delete('inscriptions/:id')
  @ApiOperation({
    operationId: 'deleteEnrolementInscription',
    summary: 'Retire une inscription du miroir.',
  })
  @ApiResponse({ status: 200, type: SuppressionDto })
  async supprimer(
    @Param('projet', new ParseEnumPipe(Projet)) projet: Projet,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SuppressionDto> {
    return { supprimees: await this.enrolement.supprimer(projet, id) };
  }
}
