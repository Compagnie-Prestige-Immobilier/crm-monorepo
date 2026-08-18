import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@crm/database';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { SupervisionActivityService } from './supervision.service.js';
import { SupervisionActivityDto, SupervisionQueryDto } from './supervision.dto.js';

@ApiTags('supervision')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPERVISEUR)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'supervision', version: '1' })
export class SupervisionController {
  constructor(private readonly activity: SupervisionActivityService) {}

  @Get('activite')
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
}
