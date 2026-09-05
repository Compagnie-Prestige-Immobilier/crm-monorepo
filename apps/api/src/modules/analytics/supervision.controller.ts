import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@crm/database';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Cached } from '../../redis/cache.interceptor.js';
import { SupervisionActivityService } from './supervision.service.js';
import {
  SupervisionActivityDto,
  SupervisionQueryDto,
  UpdateWorkShiftsDto,
  WorkShiftsDto,
} from './supervision.dto.js';
import { WorkShiftsService } from './work-shifts.service.js';

@ApiTags('supervision')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'supervision', version: '1' })
export class SupervisionController {
  constructor(
    private readonly activity: SupervisionActivityService,
    private readonly shifts: WorkShiftsService,
  ) {}

  @Get('activite')
  @Cached(30)
  @ApiOperation({
    operationId: 'getSupervisionActivite',
    summary: 'Activité des téléconseillers sur la fenêtre demandée.',
    description:
      'La fenêtre porte sur la date de l’ACTE, pas sur celle de la fiche : un ' +
      'téléconseiller resté hors ligne trois semaines verrait sinon ses appels du ' +
      'lundi comptés le jeudi de la synchronisation. Les lignes n’existent qu’aux ' +
      'périodes où il s’est passé quelque chose ; `teleconseillers` porte la liste ' +
      'complète et le reste à faire, qu’aucune date ne borne.',
  })
  @ApiResponse({ status: 200, type: SupervisionActivityDto })
  activite(@Query() query: SupervisionQueryDto): Promise<SupervisionActivityDto> {
    return this.activity.activite(query);
  }

  @Get('creneaux')
  @ApiOperation({ operationId: 'getSupervisionCreneaux', summary: 'Créneaux de travail suivis.' })
  @ApiResponse({ status: 200, type: WorkShiftsDto })
  creneaux(): Promise<WorkShiftsDto> {
    return this.shifts.get();
  }

  @Put('creneaux')
  @ApiOperation({
    operationId: 'updateSupervisionCreneaux',
    summary: 'Modifie les créneaux de travail.',
  })
  @ApiResponse({ status: 200, type: WorkShiftsDto })
  updateCreneaux(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateWorkShiftsDto,
  ): Promise<WorkShiftsDto> {
    return this.shifts.update(user.id, body);
  }
}
